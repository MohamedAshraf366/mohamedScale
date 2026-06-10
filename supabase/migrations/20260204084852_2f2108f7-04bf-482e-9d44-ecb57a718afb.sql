-- =====================================================
-- TOPOLOGY-BASED GEOGRAPHIC MANAGEMENT SYSTEM
-- Phase 2: Create Topology Tables
-- =====================================================

-- Enable RLS on all new tables
-- =====================================================

-- 1. GEO_VERTICES: Unique points (no duplicates)
-- =====================================================
CREATE TABLE public.geo_vertices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(lat, lng)
);

-- Enable RLS
ALTER TABLE public.geo_vertices ENABLE ROW LEVEL SECURITY;

-- Policies for geo_vertices
CREATE POLICY "Allow read access to geo_vertices"
  ON public.geo_vertices FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert on geo_vertices"
  ON public.geo_vertices FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on geo_vertices"
  ON public.geo_vertices FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on geo_vertices"
  ON public.geo_vertices FOR DELETE
  USING (auth.role() = 'authenticated');

-- Index for spatial queries
CREATE INDEX idx_geo_vertices_coords ON public.geo_vertices(lat, lng);

-- =====================================================
-- 2. GEO_EDGES: Connections between two vertices
-- =====================================================
CREATE TABLE public.geo_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_vertex_id UUID NOT NULL REFERENCES public.geo_vertices(id) ON DELETE CASCADE,
  end_vertex_id UUID NOT NULL REFERENCES public.geo_vertices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  -- Ensure edges are unique (unordered pair)
  CONSTRAINT unique_edge CHECK (start_vertex_id < end_vertex_id),
  UNIQUE(start_vertex_id, end_vertex_id)
);

-- Enable RLS
ALTER TABLE public.geo_edges ENABLE ROW LEVEL SECURITY;

-- Policies for geo_edges
CREATE POLICY "Allow read access to geo_edges"
  ON public.geo_edges FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert on geo_edges"
  ON public.geo_edges FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on geo_edges"
  ON public.geo_edges FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on geo_edges"
  ON public.geo_edges FOR DELETE
  USING (auth.role() = 'authenticated');

-- Indexes for edge lookups
CREATE INDEX idx_geo_edges_start ON public.geo_edges(start_vertex_id);
CREATE INDEX idx_geo_edges_end ON public.geo_edges(end_vertex_id);

-- =====================================================
-- 3. REGION_EDGES: Junction table for region boundaries
-- =====================================================
CREATE TABLE public.region_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  edge_id UUID NOT NULL REFERENCES public.geo_edges(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_reversed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(region_id, position),
  UNIQUE(region_id, edge_id)
);

-- Enable RLS
ALTER TABLE public.region_edges ENABLE ROW LEVEL SECURITY;

-- Policies for region_edges
CREATE POLICY "Allow read access to region_edges"
  ON public.region_edges FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert on region_edges"
  ON public.region_edges FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on region_edges"
  ON public.region_edges FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on region_edges"
  ON public.region_edges FOR DELETE
  USING (auth.role() = 'authenticated');

-- Index for fast region lookups
CREATE INDEX idx_region_edges_region ON public.region_edges(region_id);
CREATE INDEX idx_region_edges_edge ON public.region_edges(edge_id);

-- =====================================================
-- 4. ZONE_EDGES: Junction table for zone boundaries
-- =====================================================
CREATE TABLE public.zone_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  edge_id UUID NOT NULL REFERENCES public.geo_edges(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  is_reversed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_id, position),
  UNIQUE(zone_id, edge_id)
);

-- Enable RLS
ALTER TABLE public.zone_edges ENABLE ROW LEVEL SECURITY;

-- Policies for zone_edges
CREATE POLICY "Allow read access to zone_edges"
  ON public.zone_edges FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert on zone_edges"
  ON public.zone_edges FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on zone_edges"
  ON public.zone_edges FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated delete on zone_edges"
  ON public.zone_edges FOR DELETE
  USING (auth.role() = 'authenticated');

-- Index for fast zone lookups
CREATE INDEX idx_zone_edges_zone ON public.zone_edges(zone_id);
CREATE INDEX idx_zone_edges_edge ON public.zone_edges(edge_id);

-- =====================================================
-- 5. FUNCTION: Compute polygon GeoJSON from edges
-- =====================================================
CREATE OR REPLACE FUNCTION public.compute_polygon_geojson(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coords JSONB := '[]'::JSONB;
  v_edge RECORD;
  v_start_lat NUMERIC;
  v_start_lng NUMERIC;
  v_end_lat NUMERIC;
  v_end_lng NUMERIC;
BEGIN
  IF p_entity_type = 'region' THEN
    FOR v_edge IN
      SELECT 
        re.is_reversed,
        sv.lat as start_lat, sv.lng as start_lng,
        ev.lat as end_lat, ev.lng as end_lng
      FROM region_edges re
      JOIN geo_edges ge ON ge.id = re.edge_id
      JOIN geo_vertices sv ON sv.id = ge.start_vertex_id
      JOIN geo_vertices ev ON ev.id = ge.end_vertex_id
      WHERE re.region_id = p_entity_id
      ORDER BY re.position
    LOOP
      IF v_edge.is_reversed THEN
        v_start_lat := v_edge.end_lat;
        v_start_lng := v_edge.end_lng;
        v_end_lat := v_edge.start_lat;
        v_end_lng := v_edge.start_lng;
      ELSE
        v_start_lat := v_edge.start_lat;
        v_start_lng := v_edge.start_lng;
        v_end_lat := v_edge.end_lat;
        v_end_lng := v_edge.end_lng;
      END IF;
      
      -- Add start point (GeoJSON uses [lng, lat] order)
      v_coords := v_coords || jsonb_build_array(jsonb_build_array(v_start_lng, v_start_lat));
    END LOOP;
    
  ELSIF p_entity_type = 'zone' THEN
    FOR v_edge IN
      SELECT 
        ze.is_reversed,
        sv.lat as start_lat, sv.lng as start_lng,
        ev.lat as end_lat, ev.lng as end_lng
      FROM zone_edges ze
      JOIN geo_edges ge ON ge.id = ze.edge_id
      JOIN geo_vertices sv ON sv.id = ge.start_vertex_id
      JOIN geo_vertices ev ON ev.id = ge.end_vertex_id
      WHERE ze.zone_id = p_entity_id
      ORDER BY ze.position
    LOOP
      IF v_edge.is_reversed THEN
        v_start_lat := v_edge.end_lat;
        v_start_lng := v_edge.end_lng;
      ELSE
        v_start_lat := v_edge.start_lat;
        v_start_lng := v_edge.start_lng;
      END IF;
      
      v_coords := v_coords || jsonb_build_array(jsonb_build_array(v_start_lng, v_start_lat));
    END LOOP;
  END IF;
  
  -- Close the polygon by adding the first point at the end
  IF jsonb_array_length(v_coords) > 0 THEN
    v_coords := v_coords || jsonb_build_array(v_coords->0);
  END IF;
  
  -- Return GeoJSON Polygon
  RETURN jsonb_build_object(
    'type', 'Polygon',
    'coordinates', jsonb_build_array(v_coords)
  );
END;
$$;

-- =====================================================
-- 6. TRIGGER: Cascade updated_at when vertex changes
-- =====================================================
CREATE OR REPLACE FUNCTION public.propagate_vertex_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update all regions that use edges connected to this vertex
  UPDATE regions r
  SET updated_at = now()
  WHERE r.id IN (
    SELECT DISTINCT re.region_id
    FROM region_edges re
    JOIN geo_edges ge ON ge.id = re.edge_id
    WHERE ge.start_vertex_id = NEW.id OR ge.end_vertex_id = NEW.id
  );
  
  -- Update all zones that use edges connected to this vertex
  UPDATE zones z
  SET updated_at = now()
  WHERE z.id IN (
    SELECT DISTINCT ze.zone_id
    FROM zone_edges ze
    JOIN geo_edges ge ON ge.id = ze.edge_id
    WHERE ge.start_vertex_id = NEW.id OR ge.end_vertex_id = NEW.id
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_propagate_vertex_update
AFTER UPDATE ON public.geo_vertices
FOR EACH ROW
EXECUTE FUNCTION public.propagate_vertex_update();

-- =====================================================
-- 7. TRIGGER: Update geo_vertices.updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_geo_vertices_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_geo_vertices_updated_at
BEFORE UPDATE ON public.geo_vertices
FOR EACH ROW
EXECUTE FUNCTION public.update_geo_vertices_updated_at();

-- =====================================================
-- 8. FUNCTION: Split an edge by inserting a new vertex
-- =====================================================
CREATE OR REPLACE FUNCTION public.split_edge(
  p_edge_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_id UUID;
  v_end_id UUID;
  v_new_vertex_id UUID;
  v_new_edge1_id UUID;
  v_new_edge2_id UUID;
  v_region_edge RECORD;
  v_zone_edge RECORD;
BEGIN
  -- Get the original edge vertices
  SELECT start_vertex_id, end_vertex_id INTO v_start_id, v_end_id
  FROM geo_edges WHERE id = p_edge_id;
  
  IF v_start_id IS NULL THEN
    RAISE EXCEPTION 'Edge not found: %', p_edge_id;
  END IF;
  
  -- Create the new vertex
  INSERT INTO geo_vertices (lat, lng)
  VALUES (p_lat, p_lng)
  ON CONFLICT (lat, lng) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_new_vertex_id;
  
  -- Create two new edges (maintaining the unique constraint: start < end)
  INSERT INTO geo_edges (start_vertex_id, end_vertex_id)
  VALUES (
    LEAST(v_start_id, v_new_vertex_id),
    GREATEST(v_start_id, v_new_vertex_id)
  )
  RETURNING id INTO v_new_edge1_id;
  
  INSERT INTO geo_edges (start_vertex_id, end_vertex_id)
  VALUES (
    LEAST(v_new_vertex_id, v_end_id),
    GREATEST(v_new_vertex_id, v_end_id)
  )
  RETURNING id INTO v_new_edge2_id;
  
  -- Update region_edges that reference the old edge
  FOR v_region_edge IN
    SELECT * FROM region_edges WHERE edge_id = p_edge_id
  LOOP
    -- Delete the old reference
    DELETE FROM region_edges WHERE id = v_region_edge.id;
    
    -- Insert two new references with adjusted positions
    -- First, shift all positions after this one by 1
    UPDATE region_edges 
    SET position = position + 1 
    WHERE region_id = v_region_edge.region_id 
      AND position > v_region_edge.position;
    
    -- Insert the two new edges
    INSERT INTO region_edges (region_id, edge_id, position, is_reversed)
    VALUES 
      (v_region_edge.region_id, v_new_edge1_id, v_region_edge.position, v_region_edge.is_reversed),
      (v_region_edge.region_id, v_new_edge2_id, v_region_edge.position + 1, v_region_edge.is_reversed);
  END LOOP;
  
  -- Update zone_edges that reference the old edge
  FOR v_zone_edge IN
    SELECT * FROM zone_edges WHERE edge_id = p_edge_id
  LOOP
    DELETE FROM zone_edges WHERE id = v_zone_edge.id;
    
    UPDATE zone_edges 
    SET position = position + 1 
    WHERE zone_id = v_zone_edge.zone_id 
      AND position > v_zone_edge.position;
    
    INSERT INTO zone_edges (zone_id, edge_id, position, is_reversed)
    VALUES 
      (v_zone_edge.zone_id, v_new_edge1_id, v_zone_edge.position, v_zone_edge.is_reversed),
      (v_zone_edge.zone_id, v_new_edge2_id, v_zone_edge.position + 1, v_zone_edge.is_reversed);
  END LOOP;
  
  -- Delete the original edge (now orphaned)
  DELETE FROM geo_edges WHERE id = p_edge_id;
  
  RETURN v_new_vertex_id;
END;
$$;

-- =====================================================
-- 9. Enable Realtime for topology tables
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE geo_vertices;
ALTER PUBLICATION supabase_realtime ADD TABLE geo_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE region_edges;
ALTER PUBLICATION supabase_realtime ADD TABLE zone_edges;