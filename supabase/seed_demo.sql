-- =====================================================================
-- PLOTRAS — Demo seed data (OPTIONAL, NOT auto-applied)
-- =====================================================================
-- Fabricated test parcels near the PRD's own worked example coordinates
-- (6.4531, 3.4219 — Lagos), one per signal, so ParcelMapViewer has
-- something to render. Run manually against the `plotas` project when
-- you want to sanity-check the map. Safe to delete afterward — nothing
-- else depends on these spatial_ids.
-- =====================================================================

-- GREEN — clean parcel, no lien, no govt overlap.
INSERT INTO parcels (spatial_id, boundary, boundary_utm, state_code, lga, status, title_type)
VALUES (
    'SP-LAG-DEMO-GREEN',
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4219, 6.4531], [3.4219, 6.4535],
            [3.4225, 6.4535], [3.4225, 6.4531],
            [3.4219, 6.4531]
        ]]
    }'),
    ST_Transform(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4219, 6.4531], [3.4219, 6.4535],
            [3.4225, 6.4535], [3.4225, 6.4531],
            [3.4219, 6.4531]
        ]]
    }'), 4326, 26331),
    'LAG', 'Eti-Osa', 'STATE_APPROVED', 'Certificate of Occupancy'
);

-- YELLOW — active bank lien registered against it.
INSERT INTO parcels (spatial_id, boundary, boundary_utm, state_code, lga, status, title_type)
VALUES (
    'SP-LAG-DEMO-YELLOW',
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4230, 6.4531], [3.4230, 6.4535],
            [3.4236, 6.4535], [3.4236, 6.4531],
            [3.4230, 6.4531]
        ]]
    }'),
    ST_Transform(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4230, 6.4531], [3.4230, 6.4535],
            [3.4236, 6.4535], [3.4236, 6.4531],
            [3.4230, 6.4531]
        ]]
    }'), 4326, 26331),
    'LAG', 'Eti-Osa', 'MORTGAGE_LOCKED', 'Certificate of Occupancy'
);

INSERT INTO encumbrances (parcel_id, loan_reference, amount, status)
SELECT id, 'LN-DEMO-0001', 20000000.00, 'ACTIVE'
FROM parcels WHERE spatial_id = 'SP-LAG-DEMO-YELLOW';

-- RED — overlaps a government-acquisition zone.
INSERT INTO parcels (spatial_id, boundary, boundary_utm, state_code, lga, status, title_type)
VALUES (
    'SP-LAG-DEMO-RED',
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4241, 6.4531], [3.4241, 6.4535],
            [3.4247, 6.4535], [3.4247, 6.4531],
            [3.4241, 6.4531]
        ]]
    }'),
    ST_Transform(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4241, 6.4531], [3.4241, 6.4535],
            [3.4247, 6.4535], [3.4247, 6.4531],
            [3.4241, 6.4531]
        ]]
    }'), 4326, 26331),
    'LAG', 'Eti-Osa', 'UNCLAIMED', NULL
);

INSERT INTO govt_restricted_zones (zone_name, boundary, boundary_utm, zone_type, source_authority)
VALUES (
    'Demo Right-of-Way Acquisition',
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4243, 6.4532], [3.4243, 6.4534],
            [3.4249, 6.4534], [3.4249, 6.4532],
            [3.4243, 6.4532]
        ]]
    }'),
    ST_Transform(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4243, 6.4532], [3.4243, 6.4534],
            [3.4249, 6.4534], [3.4249, 6.4532],
            [3.4243, 6.4532]
        ]]
    }'), 4326, 26331),
    'GOVT_ACQUISITION',
    'Lagos State Ministry of Physical Planning (demo)'
);

-- PENDING_CHARTING — for testing the Government Admin Dashboard's
-- charting-approval action (app/admin/dashboard, fn_approve_charting).
INSERT INTO parcels (spatial_id, boundary, boundary_utm, state_code, lga, status, title_type)
VALUES (
    'SP-LAG-DEMO-PENDING',
    ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4252, 6.4531], [3.4252, 6.4535],
            [3.4258, 6.4535], [3.4258, 6.4531],
            [3.4252, 6.4531]
        ]]
    }'),
    ST_Transform(ST_GeomFromGeoJSON('{
        "type": "Polygon",
        "coordinates": [[
            [3.4252, 6.4531], [3.4252, 6.4535],
            [3.4258, 6.4535], [3.4258, 6.4531],
            [3.4252, 6.4531]
        ]]
    }'), 4326, 26331),
    'LAG', 'Eti-Osa', 'PENDING_CHARTING', NULL
);
