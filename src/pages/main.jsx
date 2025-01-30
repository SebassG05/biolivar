/* Written by Ye Liu */

import React from 'react';
import { SnackbarProvider } from 'notistack';

import Snackbar from '@components/snackbar';
import About from '@components/about';
import Navigator from '@components/navigator';
import Menu from '@components/menu';
import Login from '@components/login';
import Feature from '@components/feature';
import StyleController from '@components/controllers/styleController';
import LayerController from '@components/controllers/layerController';
import Canvas from '@components/canvas';
import Popup from '@components/popup';
import '@styles/materialize.min.style.css';
import RusleController from '../components/controllers/rusleController';
import BushEncroacher from '../components/controllers/bushEncoracherController';
import SearchController from '../components/controllers/searchContoller';
import DataController from '../components/controllers/dataController';
import ModelController from '../components/controllers/modelController';
import ImportController from '../components/controllers/importController';
import VegInspectorController from '../components/controllers/vegInspectorController';
import SpatioTemporalAnalysisController from '../components/controllers/spatioTemporalAnalysisController';
import BandController from '../components/controllers/bandContoller';
import BiodiversityController from '../components/controllers/biodiversityController';

class Main extends React.Component {
    render() {
        return (
            <SnackbarProvider maxSnack={3}>
                <React.Fragment>
                    <Snackbar />
                    <About />
                    <Navigator />
                    <Menu />
                    <Login />
                    <Feature />
                    <BushEncroacher/>
                    <BandController/>
                    <SearchController/>
                    <SpatioTemporalAnalysisController/>
                    <BiodiversityController/>
                    <VegInspectorController/>
                    <StyleController />
                    <LayerController />
                    <ModelController />
                    <DataController/>
                    <ImportController/>
                    <RusleController />
                    <Popup />
                    <Canvas />
                </React.Fragment>
            </SnackbarProvider>
        );
    }
}

export default Main;
