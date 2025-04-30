import React from 'react';
import Slider from '@material-ui/core/Slider';
import emitter from '@utils/events.utils';
import { Card, CardContent, Checkbox, Icon, IconButton, List, ListItem, ListItemText, Slide, Tooltip, Typography } from '@material-ui/core';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import { Collapse } from '@material-ui/core';


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
        selectedIndexType: 'NDVI' // Estado para el índice seleccionado
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
                max: newLayerData.max  // Store max value
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

        window.addEventListener('dragover', this.handleDragOver);
        window.addEventListener('drop', this.handleDrop);
    }

    componentDidUpdate(prevProps) {
        if (this.props.map !== prevProps.map) {
            this.updateDatasets();
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

    componentWillUnmount() {
        emitter.removeListener(this.openLayerControllerListener);
        emitter.removeListener(this.closeAllControllerListener);
        emitter.removeListener(this.setMapZoomListener);
        emitter.removeListener(this.handleDatasetRemoveListener);
        emitter.removeListener(this.newLayerListener);  
        emitter.removeListener(this.indexTypeListener);
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
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        background: 'linear-gradient(to right, #f7fcf5, #c7e9c0, #7fcdbb, #41b6c4, #2c7fb8, #253494)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        background: 'linear-gradient(to right, #ffffcc, #c2e699, #78c679, #31a354, #006837)',
                        borderRadius: 5,
                        margin: '10px 0'
                    }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                        <span>Disminución</span>
                        <span>Aumento</span>
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
                                {this.state.layers.map(layer => (
                                    <React.Fragment key={layer.id}>
                                        <ListItem style={styles.layerItem}>
                                            <ListItemText
                                                primary={
                                                    <span style={styles.layerText}>
                                                        <Icon fontSize="small">troubleshoot</Icon>
                                                        &nbsp;&nbsp;
                                                        <span>{this.splitAssetName(layer.id)}</span>
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
                                ))}
                            </List>
                        </CardContent>
                    </Card>
                </Slide>

                {/* Show the legend panel only if open is true and there is a visible layer */}
                {this.state.open && visibleLayer && (
                    <div style={{
                        position: 'fixed',
                        top: this.getLegendTopOffset(),
                        right: '4px',
                        width: '450px',
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 0 15px rgba(0,0,0,0.2)',
                        zIndex: 500,
                        overflow: 'hidden',
                        fontFamily: 'Arial, sans-serif',
                        margin: '5px',
                        fontSize: '12px'
                    }}>
                        {/* Main Legend collapsible */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                padding: '15px',
                                backgroundColor: '#f5f5f5',
                                borderBottom: this.state.legendExpanded ? '1px solid #ddd' : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }} onClick={this.toggleLegend}>
                                <Typography variant="body2"><strong><b>Leyenda</b></strong></Typography>
                            </div>
                            <Icon onClick={this.toggleLegend}>{this.state.legendExpanded ? 'expand_less' : 'expand_more'}</Icon>
                        </div>

                        <Collapse in={this.state.legendExpanded} timeout="auto" unmountOnExit>
                            <div style={{ padding: '15px' }}>
                                {/* Sub-collapsible for Vegetation Changes */}
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        padding: '10px 0',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="body2"><strong><b>Cambios en la vegetación</b></strong></Typography>
                                        <IconButton size="small" onClick={e => { e.stopPropagation(); this.setState({ infoOpen: !this.state.infoOpen }); }} style={{ marginLeft: 6 }}>
                                            <Icon style={{ fontSize: 18, color: '#1976d2' }}>info</Icon>
                                        </IconButton>
                                    </div>
                                    <Icon onClick={e => { e.stopPropagation(); this.toggleVegetationLegend(); }}>{this.state.showVegetationLegend ? 'expand_less' : 'expand_more'}</Icon>
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
                                        cursor: 'pointer',
                                        padding: '10px 0',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="body2"><strong><b>Análisis de la superficie</b></strong></Typography>
                                        <IconButton size="small" onClick={e => { e.stopPropagation(); this.handleSurfaceInfoClick(); }} style={{ marginLeft: 6 }}>
                                            <Icon style={{ fontSize: 18, color: '#1976d2' }}>info</Icon>
                                        </IconButton>
                                    </div>
                                    <Icon onClick={e => { e.stopPropagation(); this.toggleSurfaceAnalysisLegend(); }}>{this.state.showSurfaceAnalysisLegend ? 'expand_less' : 'expand_more'}</Icon>
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
                                    <div style={{ padding: '10px 0', textAlign: 'center' }}>
                                        {indexLegends[this.state.selectedIndexType] || <Typography variant="body2">Selecciona un índice para ver la leyenda.</Typography>}
                                    </div>
                                </Collapse>
                            </div>
                        </Collapse>
                    </div>
                )}
            </MuiThemeProvider>
        );
    }
    
}

export default LayerController;
