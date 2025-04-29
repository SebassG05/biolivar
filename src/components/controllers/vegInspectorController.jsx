/* Written by Ye Liu */

import React from 'react';
import Slide from '@material-ui/core/Slide';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import { Typography, Icon, IconButton } from '@material-ui/core';
import InfoOutlined from '@material-ui/icons/InfoOutlined';
import Collapse from '@material-ui/core/Collapse';
import Paper from '@material-ui/core/Paper';
import CloseIcon from '@material-ui/icons/Close';

import { ThemeProvider, createTheme } from '@material-ui/core/styles';
import indigo from '@material-ui/core/colors/indigo';

import emitter from '@utils/events.utils';
import { ACCESS_TOKEN } from '@/config';

import '@styles/dataController.style.css';
import ControlledAccordions from '@components/componentsJS/ControlledAccordions_';

const theme = createTheme({
    palette: {
        primary: {
            main: indigo.A200
        }
    }
});

const styles = {
    root: {
        position: 'fixed',
        top: 74,
        right: 10,
        borderRadius: 9,
        minWidth: 350,
        margin: 0,
        zIndex: 900,
        boxShadow: '-6px 6px 15px rgba(0, 0, 0, 0.15)'
    },
    rooot: {
        width: '100%',
    },
    heading: {
        fontSize: theme.typography.pxToRem(15),
        flexBasis: '33.33%',
        flexShrink: 0,
    },
    secondaryHeading: {
        fontSize: theme.typography.pxToRem(15),
        color: theme.palette.text.secondary,
    },
    header: {
        backgroundColor: 'rgba(33,150,243,255)'
    },
    content: {
        paddingBottom: 16
    },
    closeBtn: {
        position: 'absolute',
        top: 6,
        right: 8,
        fontSize: 22
    },
    searchField: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: 40,
        padding: '2px 4px'
    },
    searchBox: {
        marginLeft: 8,
        flex: 1,
        border: 'none !important'
    },
    searchBoxBtn: {
        padding: 8
    },
    searchOptionsContainer: {
        padding: '5px 2px'
    },
    searchOption: {
        color: 'rgba(0, 0, 0, 0.6)',
        cursor: 'pointer'
    },
    searchBoxProgress: {
        marginRight: 8
    },
    searchBoxDivider: {
        width: 1,
        height: 28,
        margin: 4
    },
    resultWrapperOpen: {
        maxWidth: 800
    },
    resultWrapperClosed: {
        maxWidth: 350
    },
    resultContainer: {
        paddingTop: 0,
        paddingBottom: 0
    },
    resultTable: {
        boxShadow: 'none'
    },
    uploadBoxInput: {
        display: 'none'
    },
    uploadBoxBtnEdit: {
        width: 40,
        height: 40,
        lineHeight: '40px',
        textAlign: 'center',
        borderRadius: '50%',
        fontSize: 22
    },
    wrapBtn: {
        position: 'absolute',
        bottom: 12,
        left: 18,
        padding: 10,
        fontSize: 24
    },
    addPointWrapperOpen: {
        maxWidth: 350
    },
    addPointWrapperClose: {
        width: 0
    },
    uploadBoxBtnAdd: {
        width: 90,
        height: 90,
        lineHeight: '90px',
        textAlign: 'center',
        borderRadius: '50%',
        fontSize: 30,
        backgroundColor: 'rgba(0, 0, 0, 0.08)'
    },
    previewImageContainer: {
        display: 'flex',
        alignItems: 'center'
    },
    nameTextField: {
        margin: '0 20px 0 13px'
    },
    pinyinTextField: {
        margin: '10px 20px 10px 13px'
    },
    introTextField: {
        width: '100%',
        marginTop: 5
    },
    locationImageContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
    },
    locationImage: {
        display: 'block',
        marginTop: 5,
        width: 225,
        height: 140,
        borderRadius: 3,
        cursor: 'pointer'
    },
    locationLabel: {
        display: 'block',
        marginTop: 6
    },
    actions: {
        paddingTop: 10
    },
    saveBtn: {
        display: 'inline-block',
        position: 'relative',
        marginRight: 10
    },
    saveBtnProgress: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -12,
        marginLeft: -12,
    },
    strong: {
        fontWeight: 'bold'
    }
    
};

class VegInspectorController extends React.Component {
    constructor(props) {
        super(props);
        this.controlledAccordionsRef = React.createRef();
    }

    state = {
        open: false,
        showInfo: false,
        currentIndexType: 'NDVI',
    }

    handleCloseClick = () => {
        this.setState({
            open: false
        });
    }

    handleDataSubmit = (data) => {
        this.setState({ url: data })
        console.log("Datos recibidos en BandController:", data);
        emitter.emit('moveURL', this.state.url);
        // Puedes manejar los datos como desees aquí
    };

    handleWrapClick = () => {
        // Remove temp layer
        emitter.emit('removeTempLayer');

        // Reset preview image
        this.resetPreviewImage();

        // Clear search box
        document.getElementById('search-box').value = '';

        this.setState({
            resultUnwrap: false
        });
    }

    handleSearchOptionChange = (e) => {
        // Update search options
        var option = null;
        var flag = false;
        this.state.searchOptions.map(item => {
            if (item.value === e.currentTarget.value) {
                item.checked = e.currentTarget.checked;
                option = item;
            }
            flag = flag || item.checked;
            return true;
        });

        // Check whether at least one option checked
        if (!flag) {
            emitter.emit('showSnackbar', 'error', 'Error: Please select at least one option.');
            option.checked = true;
            return;
        }

        this.setState({
            searchOptions: this.state.searchOptions
        });
    }

    handleSearchClick = () => {
        // Exit add point mode
        this.handleCancelClick();

        // Get keyword
        var keyword = document.getElementById('search-box').value;
        if (!keyword) {
            return;
        }

        // Show searching progress
        this.setState({
            searching: true
        });

        // Get search options
        var options = {};
        this.state.searchOptions.map(item => {
            options[item.value] = item.checked;
            return true;
        });

        // Initiate request
    }

    handlePreviewClick = (e, data) => {
        // Show marker and popup on map
        emitter.emit('displayTempLayer', data);
    }

    handlePreviewMapClick = () => {
        // Get GeoJSON from map
        emitter.emit('getPoint');

        this.setState({
            addPointUnwrap: false
        });
    }

    handleSelectChange = (event) => {
        this.setState({ [event.target.name]: Number(event.target.value) });
    };

    handleCancelClick = () => {
        // Remove temp point
        emitter.emit('removeTempPoint');

        // Empty input box
        document.getElementById('name').value = '';
        document.getElementById('pinyin').value = '';
        document.getElementById('introduction').value = '';

        // Reset data
        this.resetPreviewImage();
        this.resetNewPointData();

        // Wrap add point panel
        this.setState({
            addPointUnwrap: false
        });
    }

    handleInfoClick = () => {
        this.setState((prev) => ({ showInfo: !prev.showInfo }));
    };

    handleIndexTypeChange = (indexType) => {
        this.setState({ currentIndexType: indexType });
    };

    componentDidMount() {
        // Initialize popover
        var anchorEl = document.getElementById('anchorEl');

        // Initialize file reader
        var reader = new FileReader();
        reader.onload = (e) => {
            // Get image info
            var image = new Image();
            image.src = e.target.result;

            // Construct preview image object
            var previewImage = {
                longitude: image.height > image.width,
                src: e.target.result
            }

            // Preview image
            this.setState({
                previewImage: previewImage
            });
        };

        this.setState({
            reader: reader,
            anchorEl: anchorEl
        });

        // Bind event listeners
        this.openVegInspectorControllerListener = emitter.addListener('openVegInspectorController', () => {
            this.setState({
                open: true
            });
        });

        this.closeAllControllerListener = emitter.addListener('closeAllController', () => {
            this.setState({
                open: false
            });
        });

        this.updatePointListener = emitter.addListener('setPoint', (feature, styleCode, zoom) => {
            var [lng, lat] = feature.geometry.coordinates;
            var previewMapUrl = `https://api.mapbox.com/styles/v1/${styleCode}/static/pin-s+f00(${lng},${lat})/${lng},${lat},${zoom},0,1/250x155@2x?access_token=${ACCESS_TOKEN}`;

            this.setState({
                addPointUnwrap: true,
                previewMapUrl: previewMapUrl,
                geometry: feature,
                previewCoordinate: {
                    lng: parseFloat(lng).toFixed(3),
                    lat: parseFloat(lat).toFixed(3)
                }
            });
        });

        this.moveURListener = emitter.addListener('moveURL', () => {
            this.moveURL();
        });
    }

    moveURL = () => {
        var url = this.state.url
        this.setState({ movedURL: url });
        console.log(this.state.movedURL)
    }

    componentWillUnmount() {
        // Remove event listeners
        emitter.removeListener(this.openBandControllerListener);
        emitter.removeListener(this.closeAllControllerListener);
        emitter.removeListener(this.addPointListener);
        emitter.removeListener(this.updatePointListener);
        emitter.removeListener(this.moveURListener);

        var elems = document.querySelectorAll('.materialboxed');
        elems.forEach(elem => {
            if (typeof elem.destroy === 'function') elem.destroy();
        });
    }

    render() {
        // Explicaciones de cada índice (provisionales)
        const indexExplanations = {
            NDVI: '<strong> El </strong>NDVI<strong> sirve principalmente para </strong> medir la densidad y salud de la vegetación verde.<strong> Cuando el valor de NDVI en un píxel aumenta, significa que la vegetación se ha vuelto más densa o más saludable, probablemente con mayor contenido de clorofila. Cuando el NDVI disminuye, indica deterioro de la vegetación: puede deberse a estrés hídrico, pérdida de plantas, cosecha o aparición de áreas de suelo desnudo.</strong> Es uno de los índices más utilizados en agricultura, monitoreo forestal y detección de cambios estacionales.',
            EVI: '<strong>El </strong>EVI <strong>se utiliza principalmente para </strong> monitorear vegetación en zonas muy densas, como selvas o bosques tropicales, <strong> donde el NDVI se puede saturar. También sirve para cultivos con estructuras densas. Si el valor de EVI en un píxel sube, señala que la cobertura vegetal se ha fortalecido o expandido. Si el EVI baja, indica una reducción en la densidad o salud de la vegetación, posiblemente por estrés ambiental, tala, etc.</strong> Su principal ventaja es que corrige mejor los efectos de polvo, atmósfera y suelo que el NDVI.',
            SAVI: '<strong> El </strong>SAVI <strong>es utilizado principalmente para</strong> estudiar vegetación en áreas donde el suelo expuesto influye mucho en la imagen, como en zonas agrícolas en crecimiento o ambientes semiáridos. Para cultivos con entrecalles amplios sería ideal.<strong> Cuando el valor de SAVI en un píxel aumenta, significa que ha mejorado la cobertura vegetal o la actividad fotosintética. Si el valor de SAVI disminuye, sugiere reducción de vegetación, mayor exposición del suelo, o estrés de las plantas.</strong>',
            MSI: '<strong> El </strong>MSI <strong> sirve principalmente para</strong> evaluar el nivel de estrés hídrico en la vegetación.<strong> Cuando el MSI en un píxel aumenta, indica que las plantas están bajo mayor estrés por falta de agua (más secas). En cambio, si el MSI disminuye, significa que la vegetación está mejor hidratada y menos estresada.</strong> Este índice es muy útil para monitorear sequías o la eficiencia en riego agrícola.',
            NDMI: '<strong> El </strong>NDMI <strong> se utiliza principalmente para </strong> detectar cambios en el contenido de humedad de la vegetación, especialmente en gestión forestal y detección temprana de sequías. Marca principalmente las zonas con encharcamiento.<strong> Cuando el valor de NDMI en un píxel sube, significa que la vegetación o el suelo ha ganado humedad y está en mejores condiciones hídricas. Si el NDMI baja, sugiere que las plantas o el suelo está perdiendo agua y podría estar entrando en estrés hídrico.</strong>',
            NBR: '<strong> El </strong>NBR <strong>se utiliza principalmente para</strong> detectar áreas afectadas por incendios forestales o quemas y cuantificar la severidad del daño.<strong> Si el valor de NBR en un píxel disminuye fuertemente, indica daño severo: pérdida de biomasa y vegetación quemada. Por el contrario, si el NBR aumenta o se mantiene alto, indica que la vegetación está sana y no ha sido afectada por fuego.</strong> También se puede usar para evaluar la recuperación de un ecosistema tras un incendio.'
        };
        return (
            <ThemeProvider theme={theme}>
                <Slide direction="left" in={this.state.open}>
                    <Card style={styles.root}>
                        {/* Card header */}
                        <CardContent style={styles.header}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'bottom' }}>
                                    <Typography gutterBottom variant="h5" component="h2" style={{ fontFamily: 'Lato, Arial, sans-serif', color: 'white', fontWeight: '3', marginRight: 8 }}>Análisis de cambios en la vegetación</Typography>
                                </div>
                                <IconButton style={styles.closeBtn} aria-label="Close" onClick={this.handleCloseClick}>
                                    <Icon fontSize="inherit">chevron_right</Icon>
                                </IconButton>
                            </div>
                            <Typography variant="body2" color="textSecondary">Sube tu shape y obtén el mapa con el índice de vegetación.</Typography>
                        </CardContent>
                        <Collapse in={this.state.showInfo}>
                            <Paper elevation={3} style={{ margin: '16px auto', padding: 16, background: '#e3f2fd', position: 'relative', width: 480, height: 220, overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'justify' }}>
                                <IconButton size="small" style={{ position: 'absolute', top: 4, right: 4 }} onClick={this.handleInfoClick}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8, textAlign: 'justify' }}>¿Qué significa el índice seleccionado?</Typography>
                                <Typography
                                    variant="body2"
                                    style={{ fontWeight: 'bold', textAlign: 'justify' }}
                                    dangerouslySetInnerHTML={{
                                        __html: indexExplanations[this.state.currentIndexType]
                                    }}
                                />
                            </Paper>
                        </Collapse>
                        <CardContent style={styles.content}>
                            <ControlledAccordions
                                ref={this.controlledAccordionsRef}
                                onSubmit={this.handleDataSubmit}
                                onIndexTypeChange={this.handleIndexTypeChange}
                            />
                            {/* Contenedor para info y submit alineados */}
                            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <IconButton onClick={this.handleInfoClick} style={{ color: '#1976d2' }} aria-label="info">
                                        <InfoOutlined />
                                    </IconButton>
                                    <span style={{ marginLeft: 4, color: '#1976d2', fontWeight: 500, fontSize: 15, cursor: 'pointer' }} onClick={this.handleInfoClick}>
                                        Más información
                                    </span>
                                </div>
                                <button
                                    style={{ background: '#43a047', color: 'white', border: 'none', borderRadius: 4, padding: '8px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' }}
                                    onClick={() => this.controlledAccordionsRef.current && this.controlledAccordionsRef.current.submit()}
                                >
                                    SUBIR DATOS
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </Slide>
            </ThemeProvider >
        );
    }
}

export default VegInspectorController;