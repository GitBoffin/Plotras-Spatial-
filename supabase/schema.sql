-- =====================================================================
-- PLOTRAS — Phase 1 MVP Database Schema
-- Target: Supabase (PostgreSQL 15+ / PostGIS 3.x)
-- Source: Plotras Technical PRD — Part I, Section 1 (Database Schema)
-- =====================================================================
--
-- NOTE ON ADDITIONS NOT EXPLICITLY DEFINED IN THE PRD:
-- The PRD's Collision Detection Query (Section 2) joins against a
-- `users` table and a `govt_restricted_zones` table, but the PRD does
-- not supply CREATE TABLE statements for either. Both are added below
-- with the minimum shape required to satisfy the foreign keys and the
-- collision query, marked with [INFERRED]. Everything else is
-- reproduced exactly as specified in the PRD.
--
-- The PRD also explicitly warns: "The projected CRS should be
-- configurable by state and cadastral dataset... Plotras should not
-- hard-code one projection for every Nigerian jurisdiction." EPSG:26331
-- (Minna / UTM Zone 31N) is used below as the Phase 1 default per the
-- PRD's own worked example, but `parcels.utm_srid` is added so the
-- projection is data-driven rather than hard-coded — see note at the
-- bottom of the parcels table.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ---------------------------------------------------------------------
-- [INFERRED] Users
-- Referenced by parcels.current_owner_id, encumbrances.bank_id,
-- title_transfers.vendor_id/assignee_id, audit_logs.performed_by, and
-- the RBAC roles in PRD Section 5 (RETAIL_USER, SURVEYOR, LAWYER,
-- BANK_OFFICER, GOVT_ADMIN). Mirrors auth.users 1:1, per standard
-- Supabase practice, rather than duplicating auth data.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'RETAIL_USER'
        CHECK (role IN ('RETAIL_USER', 'SURVEYOR', 'LAWYER', 'BANK_OFFICER', 'GOVT_ADMIN')),
    full_name VARCHAR(200),
    bank_code VARCHAR(10),              -- populated for BANK_OFFICER role (PRD 4.B: bank_code)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Parcels / Spatial Plots
-- PRD Part I, Section 1
-- ---------------------------------------------------------------------
CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spatial_id VARCHAR(50) UNIQUE NOT NULL,
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    boundary_utm GEOMETRY(Polygon, 26331),
    state_code VARCHAR(10) NOT NULL,
    lga VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'UNCLAIMED'
        CHECK (status IN (
            'UNCLAIMED', 'DRAFT_SURVEY', 'PENDING_CHARTING',
            'STATE_APPROVED', 'MORTGAGE_LOCKED', 'TRANSFERRED'
        )),                              -- PRD 1: Property State Transitions
    current_owner_id UUID REFERENCES users(id),
    title_type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parcels_boundary
    ON parcels USING GIST(boundary);

CREATE INDEX idx_parcels_boundary_utm
    ON parcels USING GIST(boundary_utm);

-- [INFERRED — supports "CRS should be configurable by state and
-- cadastral dataset" rather than hard-coding EPSG:26331 everywhere.
-- Defaults to the PRD's worked example (Minna / UTM Zone 31N).]
ALTER TABLE parcels
    ADD COLUMN utm_srid INTEGER NOT NULL DEFAULT 26331;

-- ---------------------------------------------------------------------
-- Survey Beacons
-- PRD Part I, Section 1
-- ---------------------------------------------------------------------
CREATE TABLE beacons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
    beacon_number VARCHAR(50) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326) NOT NULL,
    geom_utm GEOMETRY(Point, 26331)
);

CREATE INDEX idx_beacons_geom
    ON beacons USING GIST(geom);

-- ---------------------------------------------------------------------
-- Bank Liens / Encumbrances
-- PRD Part I, Section 1
-- ---------------------------------------------------------------------
CREATE TABLE encumbrances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID REFERENCES parcels(id),
    bank_id UUID REFERENCES users(id),
    loan_reference VARCHAR(100) UNIQUE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'DISCHARGED')),
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    discharged_at TIMESTAMPTZ
);

CREATE INDEX idx_encumbrances_parcel_active
    ON encumbrances(parcel_id)
    WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------
-- Title Transfer Audit Trail
-- PRD Part I, Section 1
-- ---------------------------------------------------------------------
CREATE TABLE title_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID REFERENCES parcels(id),
    vendor_id UUID REFERENCES users(id),
    assignee_id UUID REFERENCES users(id),
    instrument_type VARCHAR(50) NOT NULL,
    gov_registry_vol VARCHAR(20),
    gov_registry_page VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Immutable Audit Log
-- PRD Part I, Section 1
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by UUID REFERENCES users(id),
    ip_address INET,
    previous_state JSONB,
    new_state JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- [INFERRED] Government Restricted / Acquisition Zones
-- Referenced by the Collision Detection Query (PRD Section 2) as
-- `govt_restricted_zones`, joined via ST_Intersects on `boundary_utm`.
-- Shaped to match the parcels table's spatial conventions.
-- ---------------------------------------------------------------------
CREATE TABLE govt_restricted_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name VARCHAR(150) NOT NULL,
    zone_type VARCHAR(50) NOT NULL DEFAULT 'GOVT_ACQUISITION',
    boundary GEOMETRY(Polygon, 4326) NOT NULL,
    boundary_utm GEOMETRY(Polygon, 26331),
    source_authority VARCHAR(150),      -- e.g. issuing state agency
    gazette_reference VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_govt_zones_boundary_utm
    ON govt_restricted_zones USING GIST(boundary_utm);

-- =====================================================================
-- SPATIAL COLLISION FUNCTIONS
-- PRD Part I, Section 2 ("Spatial Collision Engine") + Section 3
-- ("Collision Detection Query"), wrapped as a callable RPC so the
-- Next.js route can invoke it via supabase.rpc() instead of building
-- raw SQL client-side.
-- =====================================================================

-- Wraps the PRD's exact WITH TargetParcel AS (...) query. Takes the
-- submitted geometry as GeoJSON (already in EPSG:4326, per PRD's
-- "Consumer / Mobile GPS — WGS84 EPSG:4326" convention), transforms it
-- to the target UTM zone, and returns one row per intersecting
-- parcel/encumbrance/restricted-zone combination.
CREATE OR REPLACE FUNCTION fn_spatial_collision_check(
    input_geojson JSONB,
    target_srid INTEGER DEFAULT 26331
)
RETURNS TABLE (
    spatial_id VARCHAR,
    parcel_status VARCHAR,
    overlap_percentage NUMERIC,
    loan_reference VARCHAR,
    lien_status VARCHAR,
    govt_acquisition_zone VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH TargetParcel AS (
        SELECT
            ST_Transform(
                ST_SetSRID(
                    ST_GeomFromGeoJSON(input_geojson::text),
                    4326
                ),
                target_srid
            ) AS geom_utm
    )
    SELECT
        p.spatial_id,
        p.status AS parcel_status,

        CASE
            WHEN ST_Area(tp.geom_utm) = 0 THEN 0
            ELSE (
                ST_Area(
                    ST_Intersection(p.boundary_utm, tp.geom_utm)
                ) / ST_Area(tp.geom_utm)
            ) * 100
        END AS overlap_percentage,

        e.loan_reference,
        e.status AS lien_status,
        g.zone_name AS govt_acquisition_zone

    FROM TargetParcel tp

    LEFT JOIN parcels p
        ON ST_Intersects(p.boundary_utm, tp.geom_utm)

    LEFT JOIN encumbrances e
        ON p.id = e.parcel_id
        AND e.status = 'ACTIVE'

    LEFT JOIN govt_restricted_zones g
        ON ST_Intersects(g.boundary_utm, tp.geom_utm);
END;
$$;

-- Convenience function for the four-beacon submission flow (PRD
-- Section 4.A: search_mode "BEACONS"). Builds a closed polygon from an
-- ordered array of {lat, lng} points and delegates to the collision
-- function above. Requires >= 4 beacons per PRD's error code
-- ERR_INVALID_GEOMETRY_MIN_BEACONS.
CREATE OR REPLACE FUNCTION fn_beacons_to_collision_check(
    beacon_points JSONB,   -- e.g. '[{"lat":6.4531,"lng":3.4219}, ...]'
    target_srid INTEGER DEFAULT 26331
)
RETURNS TABLE (
    spatial_id VARCHAR,
    parcel_status VARCHAR,
    overlap_percentage NUMERIC,
    loan_reference VARCHAR,
    lien_status VARCHAR,
    govt_acquisition_zone VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    ring_geojson JSONB;
    coords JSONB;
BEGIN
    IF jsonb_array_length(beacon_points) < 4 THEN
        RAISE EXCEPTION 'ERR_INVALID_GEOMETRY_MIN_BEACONS: at least 4 beacons are required';
    END IF;

    -- Build a closed ring: [lng, lat] pairs, first point repeated last.
    SELECT jsonb_agg(jsonb_build_array(elem->'lng', elem->'lat'))
    INTO coords
    FROM jsonb_array_elements(beacon_points) elem;

    coords := coords || jsonb_build_array(
        jsonb_build_array(
            beacon_points->0->'lng',
            beacon_points->0->'lat'
        )
    );

    ring_geojson := jsonb_build_object(
        'type', 'Polygon',
        'coordinates', jsonb_build_array(coords)
    );

    RETURN QUERY
    SELECT * FROM fn_spatial_collision_check(ring_geojson, target_srid);
END;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- PRD Section 5 (RBAC) + Section "Access to PII should be controlled
-- separately from general spatial-data access." Baseline policies only
-- — refine per-role scopes (read:basic_signal, write:lien_lock, etc.)
-- as the RPC/API layer matures.
-- =====================================================================

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE beacons ENABLE ROW LEVEL SECURITY;
ALTER TABLE encumbrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE title_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Spatial signal data (parcel status + geometry) is non-PII and is
-- readable by any authenticated user, per PRD 5: "Run basic coordinate
-- check" = ✅ for every role.
CREATE POLICY parcels_read_basic_signal ON parcels
    FOR SELECT TO authenticated
    USING (true);

-- Only the service role (via the Next.js route, using the service key)
-- writes parcels/encumbrances/title_transfers/audit_logs directly.
-- Client-side writes go through the RPCs / API routes, never direct
-- table access.
CREATE POLICY users_read_own ON users
    FOR SELECT TO authenticated
    USING (id = auth.uid());
