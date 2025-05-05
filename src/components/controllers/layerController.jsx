import React from 'react';
import Slider from '@material-ui/core/Slider';
import emitter from '@utils/events.utils';
import { Card, CardContent, Checkbox, Icon, IconButton, List, ListItem, ListItemText, Slide, Tooltip, Typography } from '@material-ui/core';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import { Collapse } from '@material-ui/core';
import { Bar, Line } from 'react-chartjs-2';

const GlobalStyles = createTheme({
    typography: {
        fontFamily: 'Lato, Arial, sans-serif',
    },
    overrides: {
        MuiCssBaseline: {
            '@global': {
                body: {
                    fontFamily: 'Lato, Arial, sans-serif',
                },
            },
        },
    },
});

  

const styles = {
    root: {
        position: 'fixed',
        top: 74,
        right: 10,
        width: 450,
        borderRadius: 9,
        margin: 0,
        zIndex: 900,
        boxShadow: '-6px 6px 15px rgba(0, 0, 0, 0.15)',
    },
    header: {
        backgroundColor: 'rgba(253,216,53,255)'
    },
    closeBtn: {
        position: 'absolute',
        top: 6,
        right: 8,
        fontSize: 22
    },
    content: {
        paddingBottom: 16
    },
    select: {
        width: '100%'
    },
    layerList: {
        marginTop: 6,
        paddingBottom: 0
    },
    layerItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 2,
        paddingRight: 5, // Ensure some space at the right
    },
    layerText: {
            flexGrow: 1,
            paddingRight: 8 // opcional, si quieres espacio entre texto y el resto
    },
    checkbox: {
        marginRight: '8px', // Add space between the checkbox and text
    },
    slider: {
        width: '80px', // Adjust the width of the slider
        marginLeft: '10px'
    },
    legend: {
        position: 'absolute',
        bottom: '30px',
        left: '10px',
        background: 'white',
        padding: '10px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '18px',
        color: '#333',
        borderRadius: '3px',
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.2)'
    },
    legendTitle: {
        margin: '0 0 10px',
        fontSize: '14px'
    },
    legendItem: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '5px'
    },
    legendColorBox: {
        width: '20px',
        height: '10px',
        display: 'inline-block',
        marginRight: '5px'
    },
    spectralLegend: {
        position: 'absolute',
        bottom: '30px',
        left: '10px',
        background: 'white',
        padding: '10px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '12px',
        lineHeight: '18px',
        width: '20%',
        color: '#333',
        borderRadius: '3px',
        boxShadow: '0 0 15px rgba(0, 0, 0, 0.2)'
    }
};

// Utilidad para crear bins y frecuencias para el histograma
function getHistogramData(dataset, bins = 20) {
    if (!dataset || dataset.length === 0) return { labels: [], counts: [] };
    const min = Math.min(...dataset);
    const max = Math.max(...dataset);
    const step = (max - min) / bins;
    const edges = Array.from({ length: bins + 1 }, (_, i) => min + i * step);
    const counts = Array(bins).fill(0);
    dataset.forEach(val => {
        let idx = Math.floor((val - min) / step);
        if (idx === bins) idx = bins - 1;
        counts[idx]++;
    });
    const labels = edges.slice(0, -1).map((e, i) => `${e.toFixed(2)} - ${edges[i+1].toFixed(2)}`);
    return { labels, counts };
}

// Utilidad para generar un array de fechas mensuales entre dos fechas (YYYY-MM-DD)
function getDateRangeLabels(start, end) {
    const result = [];
    if (!start || !end) return result;
    let current = new Date(start);
    current.setDate(1); // Siempre el día 1
    const endDate = new Date(end);
    endDate.setDate(1); // Siempre el día 1
    while (current.getFullYear() < endDate.getFullYear() || (current.getFullYear() === endDate.getFullYear() && current.getMonth() <= endDate.getMonth())) {
        result.push(current.toISOString().slice(0, 7)); // YYYY-MM
        current.setMonth(current.getMonth() + 1);
    }
    return result;
}

class LayerController extends React.Component {
    state = {
        open: false,
        mapp: null,
        selected: {},
        resolution: 7,
        zoom: 0,
        layerForm: 'Border',
        datasets: {},
        layers: [],
        assets: [], // Aquí guardaremos los assets de GEE
        selectedAsset: '', // Aquí guardamos el asset seleccionado por el usuario
        mapUrl: '', // Aquí guardamos la URL del mapa generado
        legendExpanded: false,
        showVegetationLegend: false,
        infoOpen: false,
        showSurfaceAnalysisLegend: false, // Nuevo estado para el subdesplegable
        showSurfaceInfo: false, // Estado para el info del subdesplegable
        selectedIndexType: 'NDVI', // Estado para el índice seleccionado
        activeTool: null, // Nuevo estado para saber qué herramienta está activa
        showChart: true, // Estado para mostrar/ocultar la gráfica
        showHistogram: false, // Nuevo estado para el histograma
        dates: null, // Fechas del dataset temporal
        temporalValues: null, // Valores del dataset temporal
        showBigSurfaceChart: false, // Estado para mostrar el modal con la gráfica ampliada
        bandDates: null // Fechas seleccionadas por el usuario en BandController
    }

    handleCloseClick = () => {
        this.setState({
            open: false,
            legendExpanded: false,
            showVegetationLegend: false
        });
    }

    truncateLayerName = (name) => {
        if (name.length > 7) {
            return name.substring(0, 4) + '...'; // Keep the first 10 characters and add '...'
        }
        return name; // Return the name as is if it's 13 characters or fewer
    }

    handleDatasetChange = async (e) => {
        var deleting = false;
        Object.keys(this.state.selected).map(item => {
            deleting = true;
            this.setState({
                selected: {}
            });
            return true;
        });

        if (!deleting && e.target.value.length) {
            const id = e.target.value[e.target.value.length - 1];
            emitter.emit('showSnackbar', 'default', `Downloading dataset '${id}'.`);
            emitter.emit('displayDataset', id, this.state.datasets[id].data, '#f08');
            emitter.emit('showSnackbar', 'success', `Dataset '${id}' downloaded successfully.`);
        }
    };

    handleShapeChange = (e) => {
        this.setState({ shape: e.target.value });
    }

    // Toggle visibility of a layer and emit event to canvas.jsx
    // Manejar el cambio de visibilidad
    handleLayerVisibilityChange = (layerId) => {
        const updatedLayers = this.state.layers.map(layer =>
            layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
        );
        this.setState({ layers: updatedLayers });

        // Emitimos un evento para cambiar la visibilidad de la capa en Canvas
        emitter.emit('toggleLayerVisibility', layerId, updatedLayers.find(layer => layer.id === layerId).visible);
    };

    // Manejar el cambio de transparencia
    handleTransparencyChange = (layerId, value) => {
        const updatedLayers = this.state.layers.map(layer =>
            layer.id === layerId ? { ...layer, transparency: value } : layer
        );
        this.setState({ layers: updatedLayers });

        // Emitimos un evento para cambiar la transparencia de la capa en Canvas
        emitter.emit('changeLayerTransparency', layerId, value / 100);  // Normalizamos de 0 a 1
    };


    // Función para cortar el nombre del asset después del "/0" o devolver el nombre si no lo tiene
    splitAssetName = (assetPath) => {
        const parts = assetPath.split('/'); // Dividimos el path por "/"
        let lastPart = parts[parts.length - 1]; // Tomamos la última parte del path
    
        // Si el nombre comienza con "0", lo removemos
        if (lastPart.startsWith('0')) {
            lastPart = lastPart.substring(1); // Eliminar el primer carácter ("0")
        }
        
        return lastPart; // Devolver la última parte procesada
    };


    handleDrop = (event) => {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = JSON.parse(e.target.result);
                const geoJsonData = data;

                // Add the new layer with default visibility and transparency
                const newLayer = { id: file.name, visible: true, transparency: 100 };

                // Update layers and datasets
                this.setState((prevState) => ({
                    datasets: { ...prevState.datasets, [file.name]: { data: geoJsonData } },
                    layers: [...prevState.layers, newLayer]
                }));

                emitter.emit('displayDataset', file.name, geoJsonData);
                emitter.emit('showSnackbar', 'success', `Dataset '${file.name}' added as a layer successfully.`);
            };
            reader.readAsText(file);
        }
    }; 

    componentDidMount() {

        this.openLayerControllerListener = emitter.addListener('openLayerController', () => {
            this.setState({ open: true });
        });

        // Modify the newLayer listener to store min/max if provided
        this.newLayerListener = emitter.addListener('newLayer', (newLayerData) => {
            // Assume newLayerData might contain { id, visible, transparency, min, max, ... }
            const layerToAdd = {
                id: newLayerData.id,
                visible: newLayerData.visible !== undefined ? newLayerData.visible : true, // Default to true if not provided
                transparency: newLayerData.transparency !== undefined ? newLayerData.transparency : 100, // Default to 100 if not provided
                min: newLayerData.min, // Store min value
                max: newLayerData.max,  // Store max value
                dataset: newLayerData.dataset // Store dataset if provided
            };
            this.setState((prevState) => ({
                layers: [...prevState.layers, layerToAdd]
            }));
        });

        this.closeAllControllerListener = emitter.addListener('closeAllController', () => {
            this.setState({ open: false, legendExpanded: false, showVegetationLegend: false });
        });

        this.setMapZoomListener = emitter.addListener('setMapZoom', (z) => {
            this.setState({ zoom: z });
        });

        this.handleDatasetRemoveListener = emitter.addListener('handleDatasetRemove', () => {
            this.handleDatasetRemove();
        });

        // Escuchar cambios de índice desde el controlador de bandas
        this.indexTypeListener = emitter.addListener('indexTypeChanged', (indexType) => {
            this.setState({ selectedIndexType: indexType });
        });

        // Escuchar qué herramienta está activa
        this.activeToolListener = emitter.addListener('setActiveTool', (tool) => {
            this.setState({ activeTool: tool });
        });

        // Escuchar fechas seleccionadas por el usuario en BandController
        this.bandDatesListener = emitter.addListener('setBandDates', (datesArray) => {
            this.setState({ bandDates: datesArray });
        });

        window.addEventListener('dragover', this.handleDragOver);
        window.addEventListener('drop', this.handleDrop);
    }

    componentDidUpdate(prevProps, prevState) {
        if (this.props.map !== prevProps.map) {
            this.updateDatasets();
        }
        // Detectar si el dataset activo es temporal (array de objetos con Date y Value)
        const visibleLayer = this.state.layers.find(layer => layer.visible);
        if (visibleLayer && Array.isArray(visibleLayer.dataset) && visibleLayer.dataset.length > 0 && typeof visibleLayer.dataset[0] === 'object' && visibleLayer.dataset[0].Date && visibleLayer.dataset[0].Value) {
            const dates = visibleLayer.dataset.map(item => item.Date);
            const values = visibleLayer.dataset.map(item => item.Value);
            // Solo actualiza si cambió
            if (!this.state.dates || JSON.stringify(this.state.dates) !== JSON.stringify(dates)) {
                this.setState({ dates, temporalValues: values });
            }
        }
    }

    
getLegendContent = (layer) => { // Changed parameter from layerId to layer
    if (!layer) return null; // Return null if no layer object is provided
    const layerId = layer.id; // Get id from the layer object

    if (layerId.includes('VICI')) {
        // Use layer.min and layer.max if available, otherwise default or show placeholder
        const minValue = Number(layer.min);
        const minText = isNaN(minValue) ? '' : minValue.toFixed(2);
        const maxValue = Number(layer.max);
        const maxText = isNaN(maxValue) ? '' : maxValue.toFixed(2);
        return (
            <div style={{ padding: '10px', textAlign: 'center' }}>
                <Typography><strong>Vegetation Change</strong> %/year</Typography>
                <div style={{ 
                    width: '100%', 
                    height: '20px', 
                    background: 'linear-gradient(to right, red, white, green)', 
                    margin: '10px 0', 
                    borderRadius: '5px' 
                }}>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {/* Display dynamic min value */}
                    <Typography variant="body2">{minText}</Typography>
                    {/* Display dynamic max value */}
                    <Typography variant="body2">{maxText}</Typography>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Decline</Typography>
                    <Typography variant="body2">Increase</Typography>
                </div>
            </div>
        );
    } else if (layerId.includes('Erosion')) {
        return (
            <div>
                <Typography><strong>Soil Loss</strong> (t/hac/year)</Typography>
                                {['#490EFF', '#12F4FF', '#12FF50', '#E5FF12', '#FF4812'].map((color, index) => {
                    const labels = [
                        'Slight (<10)',
                        'Moderate (10-20)',
                        'High (20-30)',
                        'Very high (30-40)',
                        'Severe (>40)'
                    ];
                    return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ width: '20px', height: '20px', backgroundColor: color, marginRight: '10px' }}></span>
                            <Typography>{labels[index]}</Typography>
                        </div>
                    );
                })}
            </div>
        );
    } else if (layerId.includes('DSM')) {
        return (
            <div>
                <Typography><strong>DSM</strong> (t/ha)</Typography>
                {['#ffffe5', '#fee391', '#fec44f', '#ec7014', '#8c2d04'].map((color, index) => {
                    const labels = [
                        '0 - 1.2',
                        '1.2 - 2.4',
                        '2.4 - 3.6',
                        '3.6 - 4.8',
                        '4.8 - 6'
                    ];
                    return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ width: '20px', height: '20px', backgroundColor: color, marginRight: '10px' }}></span>
                            <Typography>{labels[index]}</Typography>
                        </div>
                    );
                })}
            </div>
        );
    } else if (layerId.includes('avg')) {
        return (
            <div>
                <Typography><strong>Habitat Suitability</strong></Typography>
                {['#ffffff', '#cceacc', '#66bf66', '#006600'].map((color, index) => {
                    const labels = [
                        'Unsuitable',
                        'Low suitability',
                        'Moderate suitability',
                        'High suitability'
                    ];
                    return (
                        <div key={index} style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ width: '20px', height: '20px', backgroundColor: color, marginRight: '10px' }}></span>
                            <Typography>{labels[index]}</Typography>
                        </div>
                    );
                })}
            </div>
        );
    } else if (layerId.includes('Suelo')) {
        const usoSueloValues = [ 
            'Tejido urbano continuo', 'Tejido urbano discontinuo', 'Zonas industriales o comerciales',
            'Redes viarias, ferroviarias y terrenos asociados', 'Zonas portuarias', 'Aeropuertos',
            'Zonas de extracción minera', 'Escombreras y vertederos', 'Zonas en construcción',
            'Zonas verdes urbanas', 'Instalaciones deportivas y recreativas', 'Tierras de labor en secano',
            'Terrenos regados permanentemente', 'Arrozales', 'Viñedo', 'Frutales', 'Olivares',
            'Prados y Praderas', 'Cultivos anuales asociados con cultivos permanentes', 'Mosaico de cultivos',
            'Terrenos principalmente agrícolas, pero con importantes espacios de vegetación natural',
            'Sistemas agroforestales', 'Bosques de frondosas', 'Bosques de coníferas', 'Bosque mixto',
            'Pastizales naturales', 'Landas y matorrales', 'Matorrales esclerófilos',
            'Matorral boscoso de transición', 'Playas, dunas y arenales', 'Roquedo',
            'Espacios con vegetación escasa', 'Zonas quemadas', 'Humedales y zonas pantanosas', 'Marismas',
            'Salinas', 'Zonas llanas intermareales', 'Cursos de agua'
        ];

        const colores = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
            '#8B0000', '#A52A2A', '#5F9EA0', '#7FFF00', '#D2691E', '#6495ED', '#DC143C', '#00FA9A',
            '#FFD700', '#ADFF2F', '#4B0082', '#20B2AA', '#9370DB', '#3CB371', '#7B68EE', '#48D1CC',
            '#C71585', '#191970', '#FF4500', '#DA70D6', '#32CD32', '#4682B4', '#FA8072', '#778899',
            '#8A2BE2', '#00CED1', '#FF1493', '#2E8B57', '#7CFC00', '#B8860B'
        ];

        return (
            <div>
                <Typography><strong>Uso del Suelo</strong></Typography>
                <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    padding: '10px',
                    marginTop: '10px'
                }}>
                    {usoSueloValues.map((value, index) => (
                        <div key={index} style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                            <span style={{ 
                                width: '20px', 
                                height: '20px', 
                                backgroundColor: colores[index], 
                                marginRight: '10px' 
                            }}></span>
                            <Typography>{value}</Typography>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
};


    handleAssetChange = (event) => {
        const selectedAsset = event.target.value.id;  // Obtenemos el id del asset
        const selectedType = event.target.value.type;  // Obtenemos el tipo del asset
    
        this.setState({
            selectedAsset: selectedAsset,
            selectedAssetType: selectedType
        });
    
        // Obtener la URL del mapa del asset seleccionado
        this.fetchMapUrl(selectedAsset, selectedType);
    };
    

    handleDatasetRemove() {
        this.setState({ datasets: {}, selected: {} });
    }

    handleToggleHistogram = () => {
        this.setState(prev => ({ showHistogram: !prev.showHistogram }));
    };

    componentWillUnmount() {
        emitter.removeListener(this.openLayerControllerListener);
        emitter.removeListener(this.closeAllControllerListener);
        emitter.removeListener(this.setMapZoomListener);
        emitter.removeListener(this.handleDatasetRemoveListener);
        emitter.removeListener(this.newLayerListener);  
        emitter.removeListener(this.indexTypeListener);
        emitter.removeListener(this.activeToolListener);
        emitter.removeListener(this.bandDatesListener);
        window.removeEventListener('dragover', this.handleDragOver);
        window.removeEventListener('drop', this.handleDrop);
    }

    getLegendTopOffset = () => {
        const visibleLayers = this.state.layers.filter(layer => layer.visible);
        if (visibleLayers.length >= 3) {
            return '42%'; // Si hay 3 o más capas, bajamos más
        } else if (visibleLayers.length === 2) {
            return '35%'; // Si hay 2 capas
        }
        return '30%'; // Si hay 1 capa
    };    

    toggleLegend = () => {
        this.setState((prevState) => ({
            legendExpanded: !prevState.legendExpanded
        }));
    };

    toggleVegetationLegend = () => {
        this.setState(prevState => ({
          showVegetationLegend: !prevState.showVegetationLegend
        }));
      }
      
    toggleSurfaceAnalysisLegend = () => {
        this.setState(prevState => ({
            showSurfaceAnalysisLegend: !prevState.showSurfaceAnalysisLegend
        }));
    };

    handleSurfaceInfoClick = () => {
        this.setState((prev) => ({ showSurfaceInfo: !prev.showSurfaceInfo }));
    };

    render() {
        const visibleLayer = this.state.layers.find(layer => layer.visible);
        const minValue = Number(visibleLayer && visibleLayer.min);
        const minText = isNaN(minValue) ? '' : minValue.toFixed(2);
        const maxValue = Number(visibleLayer && visibleLayer.max);
        const maxText = isNaN(maxValue) ? '' : maxValue.toFixed(2);

        // Obtener el dataset del índice activo (simulación: deberías obtenerlo del backend o del estado real)
        const dataset = (visibleLayer && visibleLayer.dataset) || [];
        const histData = getHistogramData(dataset, 20);

        // Explicaciones y leyendas para cada índice
        const indexExplanations = {
            NDVI: 'NDVI Su valor varía entre -1 y +1. Cuando el valor está cerca de +1, indica vegetación densa y saludable; valores cercanos a 0 representan suelos descubiertos o vegetación muy escasa, y valores negativos indican agua, nieve o nubes.',
            BI: 'Esta funcionalidad permite analizar el brillo general de la superficie usando el índice BI. Valores altos suelen indicar suelos desnudos o zonas urbanas, valores bajos vegetación densa o agua.',
            MSI: 'El MSI no tiene un rango fijo universal, pero sus valores suelen oscilar desde valores cercanos a 0 (poca tensión hídrica) hasta valores mayores de 2 o 3 (alto estrés)',
            SAVI: 'El rango de SAVI también va de -1 a +1, pero se usa principalmente en valores positivos.',
        };
        // Paletas reales usadas en el backend para cada índice
        const indexLegends = {
            NDVI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>NDVI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #ffffbf, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Suelo Desnudo</span>
                        <span>Vegetación Sana</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            EVI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>EVI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #ffffbf, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Suelo Desnudo</span>
                        <span>Vegetación Sana</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            GNDVI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>GNDVI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #ffffbf, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Suelo Desnudo</span>
                        <span>Vegetación Sana</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            NDMI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>NDMI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #f7e7c3, #d9b77c, #a2c8a3, #51a4c5, #0050ef, #4b0082)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Menor Humedad</span>
                        <span>Mayor Humedad</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            MSI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>MSI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #f7e7c3, #d9b77c, #a2c8a3, #51a4c5, #0050ef, #4b0082)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Humedad Alta</span>
                        <span>Humedad Baja</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            BI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>BI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #ffffff, #e6e6e6, #cccccc, #b3b3b3, #999999, #808080, #666666, #4d4d4d, #333333, #1a1a1a, #000000)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Alto Brillo <span style={{fontWeight: 'normal'}}>(suelo desnudo)</span></span>
                        <span>Bajo Brillo <span style={{fontWeight: 'normal'}}>(cobertura vegetal)</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            ),
            SAVI: (
                <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle2"><b>SAVI</b></Typography>
                    <div style={{
                        width: '100%',
                        height: 20,
                        background: 'linear-gradient(to right, #a50026, #d73027, #f46d43, #fdae61, #fee08b, #ffffbf, #d9ef8b, #a6d96a, #66bd63, #1a9850, #006837)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Suelo Desnudo</span>
                        <span>Vegetación Sana</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Inicio: {localStorage.getItem('startDate') || 'N/A'}</span>
                        <span>Fin: {localStorage.getItem('endDate') || 'N/A'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
                        <span>Mín: {minText}</span>
                        <span>Máx: {maxText}</span>
                    </div>
                </div>
            )
        };

        const { activeTool } = this.state;

        // En el render, para la gráfica temporal:
        const fechasDataset = Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object' && dataset[0].Date
            ? dataset.map(d => d.Date || '')
            : null;
        const valoresDataset = Array.isArray(dataset) && dataset.length > 0 && typeof dataset[0] === 'object' && dataset[0].Value !== undefined
            ? dataset.map(d => d.Value)
            : dataset;
        const startDate = localStorage.getItem('startDate');
        const endDate = localStorage.getItem('endDate');
        const labels = getDateRangeLabels(startDate, endDate);

        return (
            <MuiThemeProvider theme={GlobalStyles}>
                <Slide direction="left" in={this.state.open}>
                    <Card style={styles.root}>
                        <CardContent style={styles.header}>
                            <Typography gutterBottom style={{ fontFamily: 'Lato, Arial, sans-serif', color: 'white', fontWeight: '3' }} variant="h5" component="h2">Capas</Typography>
                            <Typography variant="body2" color="textSecondary">Gestiona y controla las capas</Typography>
                            <IconButton style={styles.closeBtn} aria-label="Close" onClick={() => this.setState({ open: false })}>
                                <Icon fontSize="inherit">chevron_right</Icon>
                            </IconButton>
                        </CardContent>
    
                        <CardContent style={styles.content}>
                            <List id="layers" style={styles.layerList}>
                                {this.state.layers.map(layer => {
                                    const indice = ['NDVI','EVI','GNDVI','NDMI','MSI','BI','SAVI'].find(idx => layer.id.toUpperCase().includes(idx));
                                    return (
                                        <React.Fragment key={layer.id}>
                                            <ListItem style={styles.layerItem}>
                                                <ListItemText
                                                    primary={
                                                        <span style={{...styles.layerText, width: '100%', display: 'block', textAlign: 'center'}}>
                                                            <span style={{fontWeight: 'bold'}}>Índice: </span>
                                                            <span>{indice || this.splitAssetName(layer.id)}</span>
                                                        </span>
                                                    }
                                                />
                                                <Checkbox
                                                    checked={layer.visible}
                                                    onChange={() => this.handleLayerVisibilityChange(layer.id)}
                                                    color="primary"
                                                />
                                                <Slider
                                                    value={layer.transparency}
                                                    onChange={(e, value) => this.handleTransparencyChange(layer.id, value)}
                                                    min={0}
                                                    max={100}
                                                    style={styles.slider}
                                                />
                                                <Tooltip title="Download this layer" aria-label="Download this layer" enterDelay={200}>
                                                    <IconButton className="icon-container modal-trigger" aria-label="Download this layer" color="inherit">
                                                        <Icon style={styles.fontIcon}>download_icon</Icon>
                                                    </IconButton>
                                                </Tooltip>
                                            </ListItem>
                                        </React.Fragment>
                                    );
                                })}
                            </List>
                        </CardContent>
                    </Card>
                </Slide>

                {/* Show the legend panel only if open is true and there is a visible layer */}
                {this.state.open && visibleLayer && (
                    <fieldset
                        style={{
                            position: 'fixed',
                            top: this.getLegendTopOffset(),
                            right: '4px',
                            width: '450px',
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 0 15px rgba(0,0,0,0.2)',
                            zIndex: 500,
                            fontFamily: 'Arial, sans-serif',
                            margin: '5px',
                            fontSize: '12px',
                            maxHeight: 'calc(100vh - 100px)',
                            padding: 0,
                            border: '1px solid #ddd',
                        }}
                    >
                        <legend
                            style={{
                                width: '100%',
                                height: '60px',
                                overflowY: 'auto',
                                background: '#f5f5f5',
                                borderRadius: '8px 8px 0 0',
                                padding: '10px 15px',
                                marginBottom: 0,
                                fontWeight: 700,
                                fontSize: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: this.state.legendExpanded ? '1px solid #ddd' : 'none',
                            }}
                        >
                            <span style={{display: 'flex', alignItems: 'center'}}>
                                <Typography variant="body2"><strong><b>Leyenda</b></strong></Typography>
                            </span>
                            <Icon onClick={this.toggleLegend}>{this.state.legendExpanded ? 'expand_less' : 'expand_more'}</Icon>
                        </legend>
                        <div
                            className="custom-scrollbar"
                            style={{
                                maxHeight: 'calc(100vh - 180px)',
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                padding: '0 15px 15px 15px',
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#81c784 #e0e0e0',
                            }}
                        >
                            {/* Estilos para scroll bonito en Chrome/Safari/Edge */}
                            <style>{`
                                .custom-scrollbar::-webkit-scrollbar {
                                    width: 10px;
                                    background: #e0e0e0;
                                    border-radius: 8px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: #81c784;
                                    border-radius: 8px;
                                }
                            `}</style>
                            <Collapse in={this.state.legendExpanded} timeout="auto" unmountOnExit>
                                <div style={{ padding: 0 }}>
                                    {/* Cambios en la vegetación */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: activeTool === 'vegChange' ? 'pointer' : 'not-allowed',
                                            padding: '10px 0',
                                            borderBottom: '1px solid #eee',
                                            opacity: activeTool === 'surfaceAnalysis' ? 0.4 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Typography variant="body2"><strong><b>Cambios en la vegetación</b></strong></Typography>
                                            <IconButton size="small" onClick={e => { e.stopPropagation(); this.setState({ infoOpen: !this.state.infoOpen }); }} style={{ marginLeft: 6 }} disabled={activeTool === 'surfaceAnalysis'}>
                                                <Icon style={{ fontSize: 18, color: '#1976d2' }}>info</Icon>
                                            </IconButton>
                                        </div>
                                        <Icon onClick={e => { if (activeTool === 'vegChange') { e.stopPropagation(); this.toggleVegetationLegend(); } }}>{this.state.showVegetationLegend ? 'expand_less' : 'expand_more'}</Icon>
                                    </div>
                                    {/* Info collapsible */}
                                    <Collapse in={this.state.infoOpen} timeout="auto" unmountOnExit>
                                        <div style={{ padding: '12px 16px', background: '#f9f9f9', borderRadius: 8, margin: '8px 0' }}>
                                            <Typography variant="subtitle2" gutterBottom><b>¿Para qué sirve esta funcionalidad?</b></Typography>
                                            <Typography variant="body2" style={{ textAlign: 'justify' }}>
                                                Esta funcionalidad te muestra cómo ha cambiado la vegetación o el suelo en un lugar entre dos fechas. Usa imágenes de satélite Landsat para comparar si hay más o menos suelo desnudo, pasto o árboles, y si están más verdes o secos. <br /><br />
                                                Además, también puede mostrar si el suelo está más seco o tiene más agua, gracias a otros indicadores especiales. Todo esto se ve en un mapa con colores, para que entiendas rápido qué zonas han cambiado. Las zonas en rojo o negativas son zonas donde el índice calculado ha disminuido, es decir, la cobertura vegetal está en un peor estado que la fecha inicial del análisis. Las zonas verdes o positivas indican que la cobertura ha mejorado respecto al inicio del análisis.
                                            </Typography>
                                        </div>
                                    </Collapse>
                                    <Collapse in={this.state.showVegetationLegend} timeout="auto" unmountOnExit>
                                        <div style={{ padding: '10px 0', textAlign: 'center' }}>
                                            <Typography>Tasa de cambio del índice</Typography>
                                            <div style={{
                                                width: '100%',
                                                height: '20px',
                                                background: 'linear-gradient(to right, red, white, green)',
                                                margin: '10px 0',
                                                borderRadius: '5px'
                                            }}></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2">{minText}</Typography>
                                                <Typography variant="body2">{maxText}</Typography>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="body2">Disminución</Typography>
                                                <Typography variant="body2">Aumento</Typography>
                                            </div>
                                            {/* Mostrar fechas guardadas */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Typography variant="body2">
                                                    {localStorage.getItem('startDate') ? `Inicio: ${localStorage.getItem('startDate')}` : 'Inicio: N/A'}
                                                </Typography>
                                                <Typography variant="body2">
                                                    {localStorage.getItem('endDate') ? `Fin: ${localStorage.getItem('endDate')}` : 'Fin: N/A'}
                                                </Typography>
                                            </div>
                                        </div>
                                    </Collapse>

                                    {/* Nuevo subdesplegable: Análisis de la superficie */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: activeTool === 'surfaceAnalysis' ? 'pointer' : 'not-allowed',
                                            padding: '10px 0',
                                            borderBottom: '1px solid #eee',
                                            opacity: activeTool === 'vegChange' ? 0.4 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <Typography variant="body2"><strong><b>Análisis de la superficie</b></strong></Typography>
                                            <IconButton size="small" onClick={e => { e.stopPropagation(); this.handleSurfaceInfoClick(); }} style={{ marginLeft: 6 }} disabled={activeTool === 'vegChange'}>
                                                <Icon style={{ fontSize: 18, color: '#1976d2' }}>info</Icon>
                                            </IconButton>
                                        </div>
                                        <Icon onClick={e => { if (activeTool === 'surfaceAnalysis') { e.stopPropagation(); this.toggleSurfaceAnalysisLegend(); } }}>{this.state.showSurfaceAnalysisLegend ? 'expand_less' : 'expand_more'}</Icon>
                                    </div>
                                    <Collapse in={this.state.showSurfaceInfo} timeout="auto" unmountOnExit>
                                        <div style={{ padding: '12px 16px', background: '#f9f9f9', borderRadius: 8, margin: '8px 0' }}>
                                            <Typography variant="subtitle2" gutterBottom><b>¿Para qué sirve esta funcionalidad con el índice seleccionado?</b></Typography>
                                            <Typography variant="body2" style={{ textAlign: 'justify' }}>
                                                {indexExplanations[this.state.selectedIndexType] || 'Selecciona un índice para ver la explicación.'}
                                            </Typography>
                                        </div>
                                    </Collapse>
                                    <Collapse in={this.state.showSurfaceAnalysisLegend} timeout="auto" unmountOnExit>
                                        <div style={{ padding: '10px 0', textAlign: 'center', maxHeight: '250px', overflowY: 'auto' }}>
                                            {indexLegends[this.state.selectedIndexType] || <Typography variant="body2">Selecciona un índice para ver la leyenda.</Typography>}
                                            {/* Botón + simple, pequeño y texto 'ampliar gráfica', centrados debajo de la gráfica */}
                                            {dataset && dataset.length > 0 && (
                                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <button
                                                        style={{
                                                            background: this.state.showHistogram
                                                                ? 'linear-gradient(90deg, #43a047 0%, #a8e063 100%)'
                                                                : 'linear-gradient(90deg, #388e3c 0%, #a8e063 100%)',
                                                            border: 'none',
                                                            borderRadius: 24,
                                                            padding: '8px 28px',
                                                            cursor: 'pointer',
                                                            fontWeight: 700,
                                                            fontSize: 16,
                                                            color: '#fff',
                                                            boxShadow: '0 2px 8px rgba(67, 160, 71, 0.12)',
                                                            outline: 'none',
                                                            marginBottom: 8,
                                                            letterSpacing: 0.5,
                                                            transition: 'background 0.2s, box-shadow 0.2s',
                                                            marginTop: 8
                                                        }}
                                                        onClick={this.handleToggleHistogram}
                                                        onMouseOver={e => e.currentTarget.style.background = 'linear-gradient(90deg, #388e3c 0%, #56ab2f 100%)'}
                                                        onMouseOut={e => e.currentTarget.style.background = this.state.showHistogram
                                                            ? 'linear-gradient(90deg, #43a047 0%, #a8e063 100%)'
                                                            : 'linear-gradient(90deg, #388e3c 0%, #a8e063 100%)'}
                                                    >
                                                        {this.state.showHistogram ? 'Ocultar histograma' : 'Ver histograma'}
                                                    </button>
                                                    <Collapse in={this.state.showHistogram} timeout="auto" unmountOnExit>
                                                        <div style={{ marginTop: 8, width: '100%' }}>
                                                            <Typography variant="subtitle2" style={{ fontWeight: 600, color: '#1976d2', marginBottom: 4 }}>Histograma del índice</Typography>
                                                            <Bar
                                                                data={{
                                                                    labels: histData.labels,
                                                                    datasets: [{
                                                                        label: 'Frecuencia',
                                                                        data: histData.counts,
                                                                        backgroundColor: 'rgba(25, 118, 210, 0.35)',
                                                                        borderColor: '#1976d2',
                                                                        borderWidth: 1.5,
                                                                        borderRadius: 6
                                                                    }]
                                                                }}
                                                                options={{
                                                                    responsive: true,
                                                                    plugins: { legend: { display: false } },
                                                                    scales: {
                                                                        x: { title: { display: true, text: 'Valor del índice', color: '#1976d2', font: { weight: 600 } } },
                                                                        y: { title: { display: true, text: 'Frecuencia', color: '#1976d2', font: { weight: 600 } } }
                                                                    }
                                                                }}
                                                            />
                                                            {/* Separador visual entre las dos gráficas */}
                                                            <div style={{ marginTop: 24 }} />
                                                            {/* Gráfica de línea NDVI temporal */}
                                                            {dataset && dataset.length > 0 && (
                                                                <div style={{ width: '100%', height: 200, padding: '0 8px', position: 'relative' }}>
                                                                    <Line
                                                                        data={{
                                                                            labels,
                                                                            datasets: [{
                                                                                label: 'NDVI',
                                                                                data: valoresDataset,
                                                                                borderColor: '#1b5e20',
                                                                                backgroundColor: 'transparent',
                                                                                fill: false,
                                                                                tension: 0,
                                                                                pointRadius: 2,
                                                                                pointHoverRadius: 4,
                                                                                pointBackgroundColor: '#1b5e20',
                                                                                pointBorderColor: '#1b5e20',
                                                                                borderWidth: 1.5
                                                                            }]
                                                                        }}
                                                                        options={{
                                                                            responsive: true,
                                                                            maintainAspectRatio: true,
                                                                            plugins: { legend: { display: true } },
                                                                            scales: {
                                                                                x: {
                                                                                    title: { display: true, text: (this.state.bandDates && this.state.bandDates.length === (this.state.temporalValues ? this.state.temporalValues.length : 0)) ? 'Fecha seleccionada' : (this.state.dates && this.state.dates.length === (this.state.temporalValues ? this.state.temporalValues.length : 0)) ? 'Fecha' : 'Índice temporal', color: '#222', font: { style: 'italic' } },
                                                                                    ticks: {
                                                                                        maxRotation: 60,
                                                                                        minRotation: 60,
                                                                                        font: { size: 12 },
                                                                                        callback: function(value, index, values) {
                                                                                            // Si el label es una fecha tipo '2023-01-01', mostrar solo '2023-01'
                                                                                            const label = this.getLabelForValue(value);
                                                                                            if (typeof label === 'string' && label.match(/^\d{4}-\d{2}/)) {
                                                                                                return label.substring(0, 7);
                                                                                            }
                                                                                            return label;
                                                                                        }
                                                                                    }
                                                                                },
                                                                                y: {
                                                                                    title: { display: true, text: 'NDVI value', color: '#222', font: { style: 'italic' } },
                                                                                    min: 0, max: 1,
                                                                                    ticks: { font: { size: 12 } }
                                                                                }
                                                                            }
                                                                        }}
                                                                    />
                                                                    {/* Botón + simple, pequeño y texto 'ampliar gráfica', centrados debajo de la gráfica */}
                                                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 16 }}>
                                                                        <button
                                                                            onClick={() => this.setState({ showBigSurfaceChart: true })}
                                                                            style={{
                                                                                width: 30,
                                                                                height: 30,
                                                                                borderRadius: '50%',
                                                                                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                                                                                color: 'white',
                                                                                border: 'none',
                                                                                fontSize: 22,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                cursor: 'pointer',
                                                                                boxShadow: '0 2px 8px rgba(67, 233, 123, 0.12)',
                                                                                margin: 0,
                                                                                padding: 0
                                                                            }}
                                                                            aria-label="Ampliar gráfica"
                                                                        >
                                                                            <span style={{
                                                                                fontWeight: 'bold',
                                                                                fontSize: 26,
                                                                                lineHeight: '40px',
                                                                                width: '100%',
                                                                                textAlign: 'center',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                position: 'relative',
                                                                                top: '-1px'
                                                                            }}>+</span>
                                                                        </button>
                                                                        <span style={{ color: '#2e7d32', fontSize: 15, fontWeight: 500, userSelect: 'none', marginLeft: 10 }}>ampliar gráfica</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Collapse>
                                                </div>
                                            )}
                                        </div>
                                    </Collapse>
                                </div>
                            </Collapse>
                        </div>
                    </fieldset>
                )}

                {/* Modal para ampliar la gráfica de superficie */}
                {this.state.showBigSurfaceChart && (
                    <div
                        onClick={() => this.setState({ showBigSurfaceChart: false })}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(0,0,0,0.7)',
                            zIndex: 3000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <div
                            style={{
                                background: 'white',
                                borderRadius: 16,
                                boxShadow: '0 8px 32px rgba(33,150,243,0.25)',
                                padding: 32,
                                minWidth: 600,
                                minHeight: 400,
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <Line
                                data={{
                                    labels,
                                    datasets: [{
                                        label: 'NDVI',
                                        data: valoresDataset,
                                        borderColor: '#1b5e20',
                                        backgroundColor: 'transparent',
                                        fill: false,
                                        tension: 0,
                                        pointRadius: 2,
                                        pointHoverRadius: 4,
                                        pointBackgroundColor: '#1b5e20',
                                        pointBorderColor: '#1b5e20',
                                        borderWidth: 1.5
                                    }]
                                }}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: true } },
                                    scales: {
                                        x: {
                                            title: { display: true, text: (this.state.bandDates && this.state.bandDates.length === (this.state.temporalValues ? this.state.temporalValues.length : 0)) ? 'Fecha seleccionada' : (this.state.dates && this.state.dates.length === (this.state.temporalValues ? this.state.temporalValues.length : 0)) ? 'Fecha' : 'Índice temporal', color: '#222', font: { style: 'italic' } },
                                            ticks: {
                                                maxRotation: 60,
                                                minRotation: 60,
                                                font: { size: 16 },
                                                callback: function(value, index, values) {
                                                    const label = this.getLabelForValue(value);
                                                    if (typeof label === 'string' && label.match(/^\d{4}-\d{2}/)) {
                                                        return label.substring(0, 7);
                                                    }
                                                    return label;
                                                }
                                            }
                                        },
                                        y: {
                                            title: { display: true, text: 'NDVI value', color: '#222', font: { style: 'italic' } },
                                            min: 0, max: 1,
                                            ticks: { font: { size: 16 } }
                                        }
                                    }
                                }}
                                height={400}
                                width={800}
                            />
                        </div>
                    </div>
                )}
            </MuiThemeProvider>
        );
    }
    
}

export default LayerController;
