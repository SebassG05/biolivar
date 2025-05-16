import React from 'react';
import { Card, CardContent, Typography, Button, Grid } from '@mui/material';

function DataDisplay({ data, onBack, onSaveShape, saving }) {
    // Función para mostrar datos de los árboles
    const renderTrees = (trees) => {
        const treeEntries = Object.entries(trees).filter(([key, value]) => key !== 'recinto' && key !== 'total' && value > 0);
        if (treeEntries.length === 0) {
            return 'No existen datos de árboles disponibles.';
        }
        return treeEntries.map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`).join(', ');
    };

    return (
        <div>
            <Button onClick={onBack} variant="outlined" style={{ margin: '20px' }}>
                Back to Search
            </Button>
            <Button onClick={onSaveShape} variant="contained" color="success" style={{ margin: '20px' }} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Parcela'}
            </Button>
            <Card style={{ marginTop: '5px', marginLeft: '20px', marginRight: '20px', marginBottom: '20px' }}>
                <CardContent>
                    <Typography variant="h5" component="div">
                        Información de la Parcela
                    </Typography>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>

                    <Typography variant="subtitle1" color="textSecondary">
                        Provincia: {data.parcelaInfo.provincia || 'No existe información en SIGPAC sobre esto'}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        Municipio: {data.parcelaInfo.municipio || 'No existe información en SIGPAC sobre esto'}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        Polígono: {data.parcelaInfo.poligono}, Parcela: {data.parcelaInfo.parcela || 'No existe información en SIGPAC sobre esto'}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        Superficie: {data.parcelaInfo.dn_surface ? `${data.parcelaInfo.dn_surface.toFixed(2)} m²` : 'No existe información en SIGPAC sobre esto'}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        Referencia Catastral: {data.parcelaInfo.referencia_cat || 'No existe información en SIGPAC sobre esto'}
                    </Typography>

                    <Typography variant="h6" component="div" style={{ marginTop: '20px' }}>
                        Detalles Adicionales
                    </Typography>
                    {data.query && data.query.length > 0 ? (
                        <Grid container spacing={2}>
                            <Grid item xs={12}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, marginBottom: 8 }}>
                                    <thead>
                                        <tr style={{ background: '#f5f5f5' }}>
                                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Uso</th>
                                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Incidencias</th>
                                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Altitud (m)</th>
                                            <th style={{ border: '1px solid #ddd', padding: 8 }}>Pendiente Media (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.query.map((item, index) => (
                                            <tr key={index}>
                                                <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.uso_sigpac || 'No disponible'}</td>
                                                <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.incidencias || 'No disponible'}{item.inctexto ? ` - ${item.inctexto.join(', ')}` : ''}</td>
                                                <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.altitud || 'No disponible'}</td>
                                                <td style={{ border: '1px solid #ddd', padding: 8 }}>{item.pendiente_media || 'No disponible'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Grid>
                        </Grid>
                    ) : (
                        <Typography style={{ marginLeft: '20px' }}>No existen detalles adicionales disponibles.</Typography>
                    )}

                    <Typography variant="h6" component="div" style={{ marginTop: '20px' }}>
                                Árboles en la Parcela
                    </Typography>
                    {data.arboles && data.arboles.length > 0 ? (
                        <>

                            {data.arboles.map((arbol, index) => (
                                <Typography variant="body2" key={index}>
                                    {renderTrees(arbol)}
                                </Typography>
                            ))}
                        </>
                    ) : <Typography style={{ marginLeft: '20px' }}>No existen datos de árboles disponibles.</Typography>}

                    <Typography variant="body2" style={{ marginTop: '20px' }}>
                        Última Convergencia: {data.convergencia && data.convergencia.cat_fechaultimaconv ? new Date(data.convergencia.cat_fechaultimaconv).toLocaleDateString() : 'No disponible'}
                    </Typography>
                    <Typography variant="body2">
                        Fecha del Vuelo: {(data.vuelo && data.vuelo.fecha_vuelo) || 'No disponible'}
                    </Typography>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default DataDisplay;