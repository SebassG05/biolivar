import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import MapboxTraffic from '@mapbox/mapbox-gl-traffic';
import mapboxgl from 'mapbox-gl';
import React from 'react';

import geocoder from '@plugins/geocoder.plugin';
import marker from '@plugins/marker.plugin';
import Minimap from '@plugins/minimap.plugin';

import { ACCESS_TOKEN } from '@/config';
import '@styles/map.style.css';
import emitter from '@utils/events.utils';
import { mapStyles } from '@utils/map.utils';

const styles = {
    root: {
        width: '100%',
        position: 'fixed',
        top: 64,
        bottom: 0
    }
};

class Canvas extends React.Component {
    constructor(props) {
        super(props);
        this.mapContainer = React.createRef();
        this.state = {
            map: null,
            draw: null,
            minimap: null,
            popup: null,
            gettingPoint: null,
            tempId: null,
            styleCode: Object.values(mapStyles)[1].substring(16),
            accessGranted: false,
            points: [],
            userLayers: [],
            userSources: []
        };
    }

    flyToGeometry(map, geometry) {
        const type = geometry.type;
        let coordinates;
        console.log(geometry)

        if (type === 'FeatureCollection') {
            const firstFeature = geometry.features[0];
            coordinates = firstFeature.geometry.coordinates;
        } else if (type === 'Feature') {
            coordinates = geometry.geometry.coordinates;
        } else {
            coordinates = geometry.coordinates;
        }

        if (geometry.type === 'Polygon') {
            console.log(coordinates[0][0])
            console.log(coordinates[0][0][1], coordinates[0][0][0])
            this.state.map.flyTo({
                center: [coordinates[0][0][0], coordinates[0][0][1]],
                zoom: 15
            });
        } else if (geometry.type === 'Point') {
            this.state.map.flyTo({
                center: [coordinates[0][0], coordinates[0][1]],
                zoom: 17
            });
        }
    }

    removeTempLayer = () => {
        const layers = this.state.map.getStyle().layers;
        this.setState({
            map: null
        })
        layers.map(layer => {
            if (layer.id === 'custom-temp-point') {
                this.state.map.removeLayer('custom-temp-point');
                this.state.map.removeSource('custom-temp-point');
            }
            return true;
        });

        if (this.state.popup && this.state.popup.isOpen()) {
            this.state.popup.remove();
        }
    }

    removeAllLayer = () => {
        const layers = this.state.map.getStyle().layers;
        layers.map(layer => {
            if (layer.id.includes('-points')) {
                this.state.map.removeLayer(layer.id);
                this.state.map.removeSource(layer.source);
            }
            return true;
        });

        layers.map(layer => {
            if (layer.id.includes('-boundary')) {
                this.state.map.removeLayer(layer.id);
                this.state.map.removeSource(layer.source);
            }
            return true;
        });

        if (this.state.popup && this.state.popup.isOpen()) {
            this.state.popup.remove();
        }

        emitter.emit('handleDatasetRemove');
    }
    
    add3dLayer = () => {
        var layers = this.state.map.getStyle().layers;
        for (var layer in layers) {
            if (layer.type === 'symbol' && layer.layout['text-field']) {
                var labelLayerId = layer.id;
                break;
            }
        }

        if (this.state.map.getLayer('3d-buildings')) {
            this.state.map.moveLayer('3d-buildings', labelLayerId);
            return;
        }

        this.state.map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 12,
            'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                    "interpolate", ["linear"], ["zoom"],
                    15, 0,
                    15.05, ["get", "height"]
                ],
                'fill-extrusion-base': [
                    "interpolate", ["linear"], ["zoom"],
                    15, 0,
                    15.05, ["get", "min_height"]
                ],
                'fill-extrusion-opacity': .6
            }
        }, labelLayerId);
    }

    removeTempPoint = () => {
        this.state.draw.delete(this.state.tempId);
        this.setState({
            tempId: null
        });
    }

    saveUserLayersAndSources = () => {
        const map = this.state.map;
        if (!map) return;
        const layers = map.getStyle().layers || [];
        const sources = map.getStyle().sources || {};
        const baseSources = ['composite', 'mapbox'];
        // Filtra todas las capas que no sean del mapa base ni background/water y tengan fuente válida
        const userLayers = layers.filter(layer => {
            return !baseSources.includes(layer.source) &&
                !layer.id.startsWith('background') &&
                !layer.id.startsWith('water') &&
                layer.source && sources[layer.source];
        }).map(layer => ({ ...layer }));
        // Guarda solo fuentes válidas
        const userSources = userLayers.map(layer => {
            return {
                id: layer.source,
                source: JSON.parse(JSON.stringify(sources[layer.source]))
            };
        });
        this.setState({ userLayers, userSources });
    };

    restoreUserLayersAndSources = () => {
        const map = this.state.map;
        if (!map) return;
        // Añade fuentes primero
        this.state.userSources.forEach(({ id, source }) => {
            if (!map.getSource(id)) {
                map.addSource(id, source);
            }
        });
        // Añade capas después, siempre al final (encima de todo)
        this.state.userLayers.forEach(layer => {
            if (!map.getLayer(layer.id)) {
                const { id, type, source, layout, paint, filter, minzoom, maxzoom, ...rest } = layer;
                const layerDef = { id, type, source, layout, paint, filter, minzoom, maxzoom };
                Object.keys(layerDef).forEach(key => {
                    if (layerDef[key] === undefined) delete layerDef[key];
                });
                map.addLayer(layerDef);
            }
        });
    };

    componentDidMount() {
        mapboxgl.accessToken = ACCESS_TOKEN;

        if (!mapboxgl.supported()) {
            alert('Your browser does not support Mapbox GL');
            return;
        }

        const map = new mapboxgl.Map({
            container: this.mapContainer.current,
            style: Object.values(mapStyles)[0],
            center: [-4.835985, 37.701896],
            zoom: 7,
            antialias: true
        });

                        // Agregar puntos al mapa
                        this.state.points.forEach((point) => {
                            const el = document.createElement('div');
                            el.className = 'marker';
                            el.style.width = '20px';
                            el.style.height = '20px';
                            el.style.backgroundColor = '#ff4081';
                            el.style.borderRadius = '50%';
                            el.style.cursor = 'pointer';
                
                            // Agregar evento al hacer clic en el marcador
                            el.addEventListener('click', () => {
                                const link = document.createElement('a');
                                link.href = point.file; // Ruta al archivo PDF
                                link.download = point.id + '.pdf'; // Nombre del archivo a descargar
                                console.log(link)
                                link.click();
                            });
                
                            // Agregar marcador al mapa
                            new mapboxgl.Marker(el)
                                .setLngLat(point.coordinates)
                                .addTo(map);
                        });
        

        const draw = new MapboxDraw({
            controls: {
                combine_features: false,
                uncombine_features: false
            }
        });

        const minimap = new Minimap({
            center: map.getCenter(),
            style: Object.values(mapStyles)[0]
        });

        map.addControl(new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            localGeocoder: geocoder,
            placeholder: 'Search Address',
            marker: {
                color: 'red'
            }
        }), 'top-left');

        map.addControl(new mapboxgl.NavigationControl(), 'top-left');
        map.addControl(new mapboxgl.GeolocateControl(), 'top-left');
        map.addControl(new MapboxTraffic({
            trafficSource: new RegExp('/*/')
        }), 'top-left');
        map.addControl(draw, 'top-left');
        map.addControl(minimap, 'bottom-left');

        const popup = new mapboxgl.Popup({
            closeButton: false,
            anchor: 'bottom'
        }).setHTML('<div id="popup-container"></div>');

        document.getElementsByClassName('mapboxgl-ctrl-geocoder--input')[0].setAttribute('type', 'search-box');

        map.on('load', () => {
            this.add3dLayer();
            // Hide loader
            document.getElementById('loader-wrapper').classList.add('loaded');        
            
        });

        map.on('zoomend', () => {
            const zoomLevel = map.getZoom();
            emitter.emit('setMapZoom', zoomLevel);
        });

        map.on('draw.create', e => {
            if (!this.state.gettingPoint) {
                return;
            }

            // Save temp id
            this.setState({
                tempId: e.features[0].id
            });

            // Set point
            emitter.emit('setPoint', e.features[0], this.state.styleCode, this.state.map.getZoom());


            // Reset state
            this.setState({
                gettingPoint: false
            })
        });

        this.setMapStyleListener = emitter.addListener('setMapStyle', key => {
            if (this.state.map) {
                this.saveUserLayersAndSources();
                // Actualiza el estado styleCode y localStorage ANTES de cambiar el style
                localStorage.setItem('selectedMapStyle', key);
                this.setState({ styleCode: key }, () => {
                    this.state.map.setStyle(mapStyles[key]);
                    this.state.map.once('style.load', () => {
                        this.restoreUserLayersAndSources();
                    });
                });
            }
        });

    // Escuchar el evento para cambiar la visibilidad de las capas
        this.toggleLayerVisibilityListener = emitter.addListener('toggleLayerVisibility', (layerId, visible) => {
            if (this.state.map.getLayer(layerId)) {
                this.state.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
            }
        });

        // Escuchar el evento para cambiar la transparencia de las capas
        this.changeLayerTransparencyListener = emitter.addListener('changeLayerTransparency', (layerId, transparency) => {
            if (this.state.map.getLayer(layerId)) {
                this.state.map.setPaintProperty(layerId, 'raster-opacity', transparency);
            }
        });

        this.displayDatasetListener = emitter.addListener('displayDataset', (id, geometry) => {
            if (this.state.map.getSource(id)) {
                this.state.map.removeSource(id);
            }

            map.addSource(id, {
                'type': 'geojson',
                'data': geometry
            });

            map.addLayer({
                'id': id + '-boundary',
                'type': 'fill',
                'source': id,
                'paint': {
                    'fill-color': '#888888',
                    'fill-opacity': 0.4
                },
                'filter': ['==', '$type', 'Polygon']
            });

            map.addLayer({
                'id': id + '-points',
                'type': 'circle',
                'source': id,
                'paint': {
                    'circle-radius': 6,
                    'circle-color': '#B42222'
                },
                'filter': ['==', '$type', 'Point']
            });

            this.flyToGeometry(map, geometry);
        });

        this.removeDatasetListener = emitter.addListener('removeDataset', e => {
            const layerIds = [e + '-boundary', e + '-points'];

            layerIds.forEach(layerId => {
                if (this.state.map.getLayer(layerId)) {
                    this.state.map.removeLayer(layerId);
                }
            });

            if (this.state.map.getSource(e)) {
                this.state.map.removeSource(e);
            }
        });

        this.displayTempLayerListener = emitter.addListener('displayTempLayer', e => {
            this.removeTempLayer();

            if (!this.state.map.hasImage('marker')) {
                this.state.map.addImage('marker', marker, { pixelRatio: 3 });
            }

            this.state.map.addLayer({
                id: 'custom-temp-point',
                type: 'symbol',
                source: {
                    type: 'geojson',
                    data: e.geometry
                },
                layout: {
                    'icon-image': 'marker'
                }
            });

            this.state.popup.setLngLat(e.geometry.geometry.coordinates).addTo(this.state.map);
            emitter.emit('bindPopup', e);

            this.state.map.flyTo({
                center: e.geometry.geometry.coordinates,
                zoom: 6,
                bearing: 0
            });
        });

        this.setState({
            map: map,
            draw: draw,
            minimap: minimap,
            popup: popup
        });

        emitter.on('moveURL', this.handleURLMoved);

    }

    splitAssetName = (assetPath) => {
        const parts = assetPath.split('/'); // Dividimos el path por "/"
        let lastPart = parts[parts.length - 1]; // Tomamos la última parte del path
    
        // Si el nombre comienza con "0", lo removemos
        if (lastPart.startsWith('0')) {
            lastPart = lastPart.substring(1); // Eliminar el primer carácter ("0")
        }
        
        return lastPart; // Devolver la última parte procesada
    };

    handleURLMoved = (movedURL) => {
        console.log('Received moved data:', movedURL);
        // Extract min and max values (assuming they are at index 4 and 5)
        const mapUrl = movedURL[0];
        const layerId = movedURL[2];
        const polygon = movedURL[3];
        const minValue = movedURL[4]; // Extract min value
        const maxValue = movedURL[5]; // Extract max value

        this.setState({ url: mapUrl });
        console.log(layerId);
        
        // Emit the newLayer event including min and max values
        emitter.emit('newLayer', {
            id: layerId,          // Layer ID
            url: mapUrl,          // Map URL
            visible: true,
            transparency: 100,
            min: minValue,        // Pass min value
            max: maxValue         // Pass max value
        });
        
        console.log(movedURL)
        emitter.emit('showSnackbar', 'success', `The layer '${this.splitAssetName(layerId)}' has been loaded`);
        
        // Add layer to the map
        this.state.map.addLayer({
            'id': layerId,
            'type': 'raster',
            'source': {
                'type': 'raster',
                'tiles': [
                    mapUrl // Use mapUrl directly
                ],
                'tileSize': 256
            },
            'paint': {
                'raster-opacity': 0.8  // Layer opacity
            }
        });
        
        // Fly to geometry if available
        if (polygon && polygon.type === 'Polygon') {
            this.flyToGeometry(this.state.map, polygon)
        } else {
            console.error('Invalid or missing GeoJSON Polygon in movedURL[3]');
        }
        console.log(this.state.url);
    };
    
    componentWillUnmount() {
        emitter.removeListener(this.setMapStyleListener);
        emitter.removeListener(this.displayDatasetListener);
        emitter.removeListener(this.removeDatasetListener);
        emitter.removeListener(this.displayTempLayerListener);
        emitter.removeListener(this.toggleLayerVisibilityListener);
        emitter.removeListener(this.changeLayerTransparencyListener);  
    }

    render() {
        return (
            <div>
            <div id="map" style={styles.root} ref={this.mapContainer}/>

                            </div>
        );
    }
}

export default Canvas;