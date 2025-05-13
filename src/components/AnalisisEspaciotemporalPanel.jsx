import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import emitter from '@utils/events.utils';

export default function AnalisisEspaciotemporalPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    const handler = (data) => {
      setLoading(false);
      setResults(data);
      // Si el backend devuelve un GeoJSON, cargarlo en el mapa
      if (data && data.geojson) {
        emitter.emit('displayDataset', 'spatiotemporal_aoi', data.geojson);
      }
    };
    const loadingHandler = () => setLoading(true);
    emitter.on('spatiotemporalAnalysisResult', handler);
    emitter.on('spatiotemporalAnalysisLoading', loadingHandler);
    return () => {
      emitter.off('spatiotemporalAnalysisResult', handler);
      emitter.off('spatiotemporalAnalysisLoading', loadingHandler);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography>Procesando análisis espaciotemporal...</Typography>
      </Box>
    );
  }

  if (!results) return null;

  return (
    <Box sx={{ p: 2, background: '#f5f5f5', borderRadius: 2, boxShadow: 1, mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Análisis Espaciotemporal</Typography>
      {/* Aquí puedes renderizar tablas o gráficos con los resultados */}
      <pre style={{ maxHeight: 300, overflow: 'auto', background: '#fff', padding: 8, borderRadius: 4 }}>{JSON.stringify(results, null, 2)}</pre>
    </Box>
  );
}
