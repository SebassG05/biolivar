from flask import Flask, jsonify, request
from werkzeug.utils import secure_filename
from flask_cors import CORS
import geopandas as gpd
import pandas as pd
import zipfile
# from ria import RIA # Commented out
import ee
import requests
import os
import tempfile
import json
import math
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=["https://gobiolivar.evenor-tech.com", "http://localhost:3001"])
# ria = RIA() # Commented out

ee.Authenticate(auth_mode="gcloud")
ee.Initialize(project='soil-values-predictor')

@app.route('/api/', methods=['GET'])
def index():
    return "Estas en Biolivar"

def format_cadastral_ref(ref, delimiter=','):
    # Asumiendo que ref tiene el formato '29076A00200929'
    provincia = ref[0:2]
    municipio = ref[2:5]
    # 'A' es omitido según el ejemplo
    poligono = ref[6:9]  # Saltando 'A' que está en posición 5
    parcela = ref[9:14]
    return f"{provincia}{delimiter}{municipio}{delimiter}0{delimiter}0{delimiter}{poligono}{delimiter}{parcela}"


@app.route('/cadastral/<ref>', methods=['GET'])
def get_cadastral_data(ref):
    recinto_num = request.args.get('recintoNum', '')
    base_info_url = 'https://sigpac.mapama.gob.es/fega/serviciosvisorsigpac/layerinfo/recinto/'
    geojson_url = 'https://sigpac.mapama.gob.es/fega/ServiciosVisorSigpac/query/recintos/'

    # Obtener el ID para la URL de info y geojson
    id_info = format_cadastral_ref(ref)
    id_geojson = format_cadastral_ref(ref, delimiter='/')

    try:
        # Primera llamada para obtener información básica
        add=''
        if recinto_num:
            add += f",{recinto_num}"
        print(f"{base_info_url}{id_info}"+add)
        info_response = requests.get(f"{base_info_url}{id_info}"+add)
        info_response.raise_for_status()
        info_data = info_response.json()
        parts = id_geojson.split('/')
        print(f"{geojson_url}{id_geojson}.geojson")

        # Seleccionar los trozos primero, segundo, quinto y sexto
        selected_parts = [parts[0], parts[1], parts[4], parts[5]]

        # Quitar ceros a la izquierda
        cleaned_parts = [int(part) for part in selected_parts]
        
        print(info_data)
        # Enviamos la lista en el cuerpo de la solicitud
        response = get_boundaries(cleaned_parts, int(recinto_num))
        
        # Combinar las respuestas en un solo objeto JSON
        result = {
            'parcelInfo': info_data,
            'output': response
        }    
        
        return jsonify({
                "success": True,
                'parcelInfo': info_data,
                "output": response
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_boundaries(numbers, recinto_num):
    
# Extraemos la lista enviada
    print(numbers)
# Realizamos alguna operación con la lista (ejemplo: convertir a enteros)
    table=  None
    if(numbers[0]==41):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_41') 
    if(numbers[0]==4):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_04') 
    if(numbers[0]==11):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_11') 
    if(numbers[0]==14):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_14') 
    if(numbers[0]==18):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_18') 
    if(numbers[0]==21):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_21') 
    if(numbers[0]==23):
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_23') 
    if(numbers[0]==29):      
        table = ee.FeatureCollection('users/jbravo/sigpac/SP24_REC_29') 

    print((numbers))
    
    cd_prov = ee.Number(numbers[0]).int()
    cd_mun = ee.Number(numbers[1]).int()
    cd_pol = ee.Number(numbers[2]).int()
    cd_parcela = ee.Number(numbers[3]).long()
    cd_recinto = ee.Number(recinto_num).long()

    # Filtrar los polígonos usando los valores con tipos adecuados
    filtered_polygon = table.filter(
        ee.Filter.And(
            ee.Filter.eq('CD_PROV', cd_prov),
            ee.Filter.eq('CD_MUN', cd_mun),
            ee.Filter.eq('CD_POL', cd_pol),
            ee.Filter.eq('CD_PARCELA', cd_parcela),
            ee.Filter.eq('CD_RECINTO', cd_recinto),     # Cambia al valor que corresponda
        )
    )

    polygon_count = filtered_polygon.size().getInfo()
    if polygon_count == 0:
        print("No se encontraron polígonos con los criterios especificados.")
    elif polygon_count > 1:
        print(f"Se encontraron {polygon_count} polígonos. Ajusta los filtros para ser más específico.")
    else:
        print(f"Se encontró {polygon_count} polígono.")
    
    erosion_viz_params = {'min': 0, 'max': 10, 'palette': ['#490eff', '#12f4ff', '#12ff50', '#e5ff12', '#ff4812']}

    
    map_id = filtered_polygon.getMapId(erosion_viz_params)
    
    
    
    return[map_id['tile_fetcher'].url_format, erosion_viz_params, 'Parcela_'+str(numbers[0])+str(numbers[1])+str(numbers[1])+str(recinto_num), filtered_polygon.geometry().getInfo()]
     
@app.route('/api/rusle', methods=['POST'])
def get_rusle():
    try:
        if 'aoiDataFiles' not in request.files:
            return jsonify({"error": "No file part"}), 400

        aoi_file = request.files['aoiDataFiles']

        if aoi_file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        with tempfile.TemporaryDirectory() as temp_dir:
            aoi_filepath = os.path.join(temp_dir, secure_filename(aoi_file.filename))
            aoi_file.save(aoi_filepath)

            # Suponiendo que el shapefile se extrae en el directorio temporal
            gdf = gpd.read_file(aoi_filepath)
            geojson_dict = gdf.__geo_interface__
            aoi = ee.FeatureCollection(geojson_dict['features'])
            
            # Definir fechas desde los parámetros del request
            start_date = request.form.get('startDate')
            end_date = request.form.get('endDate')
            
            # **************** R Factor ***************
            clim_rainmap = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').filterDate(start_date, end_date)
            annual_rain = clim_rainmap.select('precipitation').sum().clip(aoi)
            R = annual_rain.multiply(0.363).add(79).rename('R')
            
            # Visualización del factor R
            R_viz_params = {'min': 300, 'max': 900, 'palette': ['a52508', 'ff3818', 'fbff18', '25cdff', '2f35ff', '0b2dab']}
            
            # **************** K Factor ***************
            soil = ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02").select('b0').clip(aoi).rename('soil')
            K = soil.expression(
                "(b('soil') > 11) ? 0.0053"
                ": (b('soil') > 10) ? 0.0170"
                ": (b('soil') > 9) ? 0.045"
                ": (b('soil') > 8) ? 0.050"
                ": (b('soil') > 7) ? 0.0499"
                ": (b('soil') > 6) ? 0.0394"
                ": (b('soil') > 5) ? 0.0264"
                ": (b('soil') > 4) ? 0.0423"
                ": (b('soil') > 3) ? 0.0394"
                ": (b('soil') > 2) ? 0.036"
                ": (b('soil') > 1) ? 0.0341"
                ": (b('soil') > 0) ? 0.0288"
                ": 0"
            ).rename('K').clip(aoi)
            
            # Visualización del factor K
            K_viz_params = {'min': 0, 'max': 0.06, 'palette': ['a52508', 'ff3818', 'fbff18', '25cdff', '2f35ff', '0b2dab']}
            
            # **************** LS Factor ***************
            dem = ee.Image("WWF/HydroSHEDS/03CONDEM")
            slope = ee.Terrain.slope(dem).clip(aoi)
            slope_percent = slope.divide(180).multiply(math.pi).tan().multiply(100)
            LS4 = math.sqrt(500 / 100)
            LS = slope_percent.expression(
                "(b('slope') * 0.53) + (b('slope') * (b('slope') * 0.076)) + 0.76"
            ).multiply(LS4).rename('LS').clip(aoi)
            
            # Visualización del factor LS
            LS_viz_params = {'min': 0, 'max': 90, 'palette': ['a52508', 'ff3818', 'fbff18', '25cdff', '2f35ff', '0b2dab']}
            
            # **************** C Factor **************


            L = 0.5;
            # Visualización del factor LS

            
            # **************** C Factor ***************
            s2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED").filterDate(start_date, end_date).median().clip(aoi)
            ndvi = s2.normalizedDifference(['B8', 'B4']).rename("NDVI")
            sentinelCollection = ee.ImageCollection('COPERNICUS/S2_HARMONIZED').filterBounds(aoi).filterDate(start_date, end_date).filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))

            sentinelMedian = sentinelCollection.median();
            savi = sentinelMedian.expression('((NIR - RED) / (NIR + RED + L)) * (1 + L)', {'NIR': sentinelMedian.select('B8'), 'RED': sentinelMedian.select('B4'), 'L': L }).rename('SAVI');

            savi_median = savi

            C = ee.Image(0.805).multiply(savi_median).multiply(-1).add(0.431).clip(aoi)

            
            # Visualización del factor C
            C_viz_params = {'min': 0, 'max': 1, 'palette': ['FFFFFF', 'CC9966', 'CC9900', '996600', '33CC00', '009900', '006600', '000000']}
            
            # **************** Erosion Calculation ***************
            erosion = R.multiply(K).multiply(LS).multiply(C).rename('erosion')
            
            erosion_viz_params = {'min': 0, 'max': 10, 'palette': ['#490eff', '#12f4ff', '#12ff50', '#e5ff12', '#ff4812']}
            
            # Generar mapa
            map_id = erosion.getMapId(erosion_viz_params) 
            bounds=aoi.geometry().getInfo()
            return jsonify({
                "success": True,
                "output": [map_id['tile_fetcher'].url_format, erosion_viz_params, 'Erosion_Result', bounds]
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/list-assets', methods=['GET'])
def list_assets():
    try:
        folder = 'users/jbravo/sigpac'  # Carpeta de ejemplo, puedes cambiar esto
        assets = ee.data.listAssets({'parent': folder})
        
        # Filtramos los assets y pasamos su tipo
        formatted_assets = [
            {'id': asset['id'], 'type': asset['type']} for asset in assets['assets']
        ]
        
        return jsonify({'assets': formatted_assets})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/get-map-url', methods=['POST'])
def get_map_url():
    try:
        data = request.get_json()
        asset_id = data.get('asset_id')  # Asset seleccionado por el usuario
        asset_type = data.get('asset_type')  # Tipo del asset (TABLE o IMAGE)
        colores = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#8B0000', '#A52A2A',
            '#5F9EA0', '#7FFF00', '#D2691E', '#6495ED', '#DC143C', '#00FA9A', '#FFD700', '#ADFF2F', '#4B0082', '#20B2AA',
            '#9370DB', '#3CB371', '#7B68EE', '#48D1CC', '#C71585', '#191970', '#FF4500', '#DA70D6', '#32CD32', '#4682B4',
            '#FA8072', '#778899', '#8A2BE2', '#00CED1', '#FF1493', '#2E8B57', '#7CFC00', '#B8860B', '#FF6347', '#4682B4',
            '#6A5ACD', '#008080', '#B22222', '#FF69B4', '#556B2F'
        ]
        # Definir los parámetros de visualización
        vis_params = {
            'palette': colores,
            'opacity': 0.65
        }
        
        url= None
        print(asset_id)
        # Verificamos el tipo de asset
        if asset_type == 'IMAGE':
            asset = ee.Image(asset_id)  # Cargar el asset como imagen
        elif asset_type == 'TABLE':
            if asset_id == "users/jbravo/sigpac/06_01_UsoSuelo":
            # Cargar el asset como FeatureCollection
                uso_suelo_values = [
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
                ]

                colores = [
                '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
                '#8B0000', '#A52A2A', '#5F9EA0', '#7FFF00', '#D2691E', '#6495ED', '#DC143C', '#00FA9A',
                '#FFD700', '#ADFF2F', '#4B0082', '#20B2AA', '#9370DB', '#3CB371', '#7B68EE', '#48D1CC',
                '#C71585', '#191970', '#FF4500', '#DA70D6', '#32CD32', '#4682B4', '#FA8072', '#778899',
                '#8A2BE2', '#00CED1', '#FF1493', '#2E8B57', '#7CFC00', '#B8860B'
                ]

            # Crear un diccionario de colores en el cliente
                color_map = dict(zip(uso_suelo_values, colores))
                feature_collection = ee.FeatureCollection(asset_id)

            # Función para asignar colores en el lado del servidor
                def style_feature(feature):
                    uso_suelo = feature.get('uso_suelo')
                    color = ee.Dictionary(color_map).get(uso_suelo, '#000000')  # Color por defecto
                    return feature.set('style', {
                        'color': color,
                        'fillColor': color,
                        'width': 1
                    })

                styled_fc = feature_collection.map(style_feature).style(**{'styleProperty': 'style'})

                map_id_dict = styled_fc.getMapId()
            
            else:
                vis_params = {}
                asset = ee.FeatureCollection(asset_id) 
                map_id_dict = asset.getMapId(vis_params)  # Obtener el MapID de esa imagen o FeatureCollection

   
            url = map_id_dict['tile_fetcher'].url_format  # Extraer la URL del mapa

        else:
            return jsonify({'error': 'Unknown asset type'}), 400
        
        # Paleta de colores destacada y valores de uso_suelo
 
        return jsonify({'map_url': [url, vis_params, asset_id]})
    except Exception as e:
        print(str(e))
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/vegetation_index_change_inspector', methods=['POST'])
def vegetation_index_change_inspector():
    try:
        # Validación de inputs
        if 'aoiDataFiles' not in request.files or 'indexType' not in request.form:
            return jsonify({"error": "Faltan datos requeridos (aoiDataFiles, indexType)"}), 400

        aoi_file = request.files['aoiDataFiles']
        band = request.form['indexType']
        start_date = request.form.get('startDate')
        end_date = request.form.get('endDate')

        # Validación de fechas
        if not start_date or not end_date:
            return jsonify({"error": "Faltan fechas (startDate, endDate)"}), 400

        try:
            start_year = int(start_date[:4])
            end_year = int(end_date[:4])
            if start_year > end_year or (start_year == end_year and start_date[5:] > end_date[5:]):
                return jsonify({"error": "El rango de fechas es inválido: la fecha de inicio debe ser anterior a la fecha de fin."}), 400
        except ValueError:
            return jsonify({"error": "Formato de fecha inválido. Use el formato YYYY-MM-DD."}), 400

        # Procesamiento del archivo AOI
        with tempfile.TemporaryDirectory() as temp_dir:
            aoi_filepath = os.path.join(temp_dir, secure_filename(aoi_file.filename))
            aoi_file.save(aoi_filepath)
            gdf = gpd.read_file(aoi_filepath)
            geojson_dict = gdf.__geo_interface__
            aoi = ee.FeatureCollection(geojson_dict['features'])

        # Definir las funciones de procesamiento
        def harmonizationRoy(oli):
            slopes = ee.Image.constant([0.9785, 0.9542, 0.9825, 1.0073, 1.0171, 0.9949])
            itcp = ee.Image.constant([-0.0095, -0.0016, -0.0022, -0.0021, -0.0030, 0.0029])
            return oli.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'], 
                              ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']) \
                      .subtract(itcp.multiply(10000)).divide(slopes).set('system:time_start', oli.get('system:time_start'))

        def getSRcollection(year, startDay, endDay, sensor, aoi):
            srCollection = ee.ImageCollection('LANDSAT/' + sensor + '/C02/T1_L2') \
                .filterBounds(aoi) \
                .filterDate(f'{year}-{startDay}', f'{year}-{endDay}')
            
            # Harmonización de Landsat 8 y selección de bandas para Landsat 5 y 7
            srCollection = srCollection.map(lambda img: harmonizationRoy(img) if sensor == 'LC08' else img \
                                            .select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']) \
                                            .resample('bicubic').set('system:time_start', img.get('system:time_start')))
            
            # Convertir bandas a tipo Integer
            srCollection = srCollection.map(lambda img: img.toInt16())
            
            return srCollection

        def getCombinedSRcollection(startYear, endYear, startDay, endDay, aoi):
            lt5 = getSRcollection(startYear, startDay, endDay, 'LT05', aoi)
            le7 = getSRcollection(startYear, startDay, endDay, 'LE07', aoi)
            lc8 = getSRcollection(startYear, startDay, endDay, 'LC08', aoi)
            return ee.ImageCollection(lt5.merge(le7).merge(lc8))
        
        def add_indices(image):
            ndvi = image.expression('float((NIR - RED) / (NIR + RED))', {
                'NIR': image.select('SR_B4'), 'RED': image.select('SR_B3')
            }).rename('NDVI')

            evi = image.expression('2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                'NIR': image.select('SR_B4'), 'RED': image.select('SR_B3'), 'BLUE': image.select('SR_B1')
            }).rename('EVI')

            savi = image.expression('((NIR - RED) / (NIR + RED + 0.5)) * (1 + 0.5)', {
                'NIR': image.select('SR_B4'), 'RED': image.select('SR_B3')
            }).rename('SAVI')

            msi = image.expression('SWIR1 / NIR', {
                'SWIR1': image.select('SR_B5'), 'NIR': image.select('SR_B4')
            }).rename('MSI')

            ndmi = image.expression('(NIR - SWIR1) / (NIR + SWIR1)', {
                'NIR': image.select('SR_B4'), 'SWIR1': image.select('SR_B5')
            }).rename('NDMI')

            nbr = image.expression('(NIR - SWIR2) / (NIR + SWIR2)', {
                'NIR': image.select('SR_B4'), 'SWIR2': image.select('SR_B7')
            }).rename('NBR')

            return image.addBands([ndvi, evi, savi, msi, ndmi, nbr])

        # Definir el rango de fechas y días del año
        startDay, endDay = start_date[5:], end_date[5:]
        
        # Obtener las colecciones de imágenes para los periodos de tiempo
        collection1 = getCombinedSRcollection(start_year, start_year, startDay, endDay, aoi)
        collection2 = getCombinedSRcollection(end_year, end_year, startDay, endDay, aoi)

        # Validar si hay imágenes en las colecciones

        # Calcular las imágenes medianas y añadir índices
        collection1_median = collection1.median().clip(aoi)
        collection2_median = collection2.median().clip(aoi)
        composite1 = add_indices(collection1_median)
        composite2 = add_indices(collection2_median)
        visualization_parameters={}
        # Calcular la diferencia de índices
        if band == "NDVI":
            delta_index = composite2.select('NDVI').subtract(composite1.select('NDVI')).rename('deltaNDVI')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -0.25,  # Mínimo valor
            'max': 0.25    # Máximo valor
        }
        elif band == "EVI":
            delta_index = composite2.select('EVI').subtract(composite1.select('EVI')).rename('deltaEVI')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -2,  # Mínimo valor
            'max': 2    # Máximo valor
        }
        elif band == "SAVI":
            delta_index = composite2.select('SAVI').subtract(composite1.select('SAVI')).rename('deltaSAVI')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -0.25,  # Mínimo valor
            'max': 0.25    # Máximo valor
        }
        elif band == "MSI":
            delta_index = composite2.select('MSI').subtract(composite1.select('MSI')).rename('deltaMSI')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -0.25,  # Mínimo valor
            'max': 0.25    # Máximo valor
        }
        elif band == "NDMI":
            delta_index = composite2.select('NDMI').subtract(composite1.select('NDMI')).rename('deltaNDMI')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -0.25,  # Mínimo valor
            'max': 0.25    # Máximo valor
        }
        elif band == "NBR":
            delta_index = composite2.select('NBR').subtract(composite1.select('NBR')).rename('deltaNBR')
            visualization_parameters = {
            'palette': ['red', 'white', 'green'],  # Paleta de colores
            'min': -0.25,  # Mínimo valor
            'max': 0.25    # Máximo valor
        }
        else:
            return jsonify({"error": "Tipo de índice desconocido"}), 400

        # Parámetros de visualización
        

        # Obtener el mapa y las visualizaciones
        map_id = delta_index.getMapId(visualization_parameters)
        bounds=aoi.geometry().getInfo()

        # Calcular min y max del delta_index dentro del AOI
        min_max_dict = delta_index.reduceRegion(
            reducer=ee.Reducer.minMax(),
            geometry=aoi.geometry(),
            scale=30,  # Ajusta la escala según sea necesario
            maxPixels=1e9
        ).getInfo()

        # Extraer min y max, manejar el caso donde no se encuentren
        min_val = min_max_dict.get('delta' + band + '_min')
        max_val = min_max_dict.get('delta' + band + '_max')

        # --- DEBUG LOGGING ---
        print(f"Calculated min: {min_val}, max: {max_val}") 
        # --- END DEBUG LOGGING ---

        # Modificar la respuesta para incluir min y max
        output_data = [
            map_id['tile_fetcher'].url_format, 
            visualization_parameters, 
            'VICI_'+band+'_Result', 
            bounds,
            min_val, # Añadir valor mínimo
            max_val  # Añadir valor máximo
        ]
        
        # --- DEBUG LOGGING ---
        print(f"Sending output data: {output_data}")
        # --- END DEBUG LOGGING ---

        return jsonify({"success": True, "output": output_data}), 200

    except Exception as e:
        print(str(e))
        return jsonify({"error": str(e)}), 500


    except Exception as e:
        print(str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route('/get_image', methods=['POST'])
def get_image():
    try:
        # Manejo de form-data con archivo
        start_date = request.form['startDate']
        end_date = request.form['endDate']
        index_type = request.form['indexType']
        
        if request.files.get('aoiDataFiles', None):
            file = request.files.get('aoiDataFiles', None)
            # Suponiendo que el archivo es un shapefile o similar que puede ser leído directamente
            gdf = gpd.read_file(file)
            geojson_dict = gdf.__geo_interface__
            bbox = ee.FeatureCollection(geojson_dict['features'])    
        else:
            # Si no hay archivo, se debe enviar un error o manejar de otra manera
            return jsonify({"error": "No geojson or file provided"}), 400
            
        coleccion_sentinel = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")\
            .filterDate(start_date, end_date)\
            .filterBounds(bbox)\
            .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', 10)
            
        mosaico = coleccion_sentinel.median().clip(bbox)
            
        mosaico_bands = mosaico.select(['B4', 'B3', 'B2', 'B11', 'B1', 'B12', 'B8', 'B5'])
        
        def calculate_ndvi(image):
            # Calcular NDVI usando la expresión
            ndvi = image.expression(
                'float((NIR - RED) / (NIR + RED))', {
                'NIR': image.select('B8'),
                'RED': image.select('B4')
            }).rename('NDVI')  # Renombrar como 'NDVI'
            
            # Imprimir NDVI (opcional, principalmente para debugging o exploración)
            
            return ndvi
        
        def calculate_evi(image):
            return image.expression(
                '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4'),
                    'BLUE': image.select('B2')
                }).rename('EVI')
            
        def calculate_gndvi(image):
            gndvi = image.expression(
                '(NIR - GREEN) / (NIR + GREEN)', 
                {
                    'NIR': image.select('B8'),  
                    'GREEN': image.select('B3')
                }).rename('GNDVI')
            return gndvi
        
        def add_indices(image):
            indices = [
                calculate_ndvi(image), calculate_evi(image), calculate_gndvi(image)
            ]
            return image.addBands(indices)


        composite_indices = add_indices(mosaico_bands)
                
        composite_clipped = []
        
        if index_type=="NDVI" :
            composite_clipped = composite_indices.clip(bbox).select("NDVI")
            
        elif index_type=="GNDVI":
            composite_clipped = composite_indices.clip(bbox).select("GNDVI")

            
        elif index_type=="EVI":
            composite_clipped = composite_indices.clip(bbox).select("EVI")
        
        

        palette = [
        'a50026', 'd73027', 'f46d43', 'fdae61', 'fee08b',
        'ffffbf', 'd9ef8b', 'a6d96a', '66bd63', '1a9850', '006837'
        ]
        visualization_parameters = {
        'min': 0.3, 'max': 0.8,  'palette':  palette
            }
        
        map_id = composite_clipped.getMapId(visualization_parameters)
        bounds=bbox.geometry().getInfo()

            
        return jsonify({"success": True, "output": [map_id['tile_fetcher'].url_format, visualization_parameters, 'BAND_'+index_type+'_Result', bounds]}), 200



    except Exception as e:
        print(str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_spectral_indexes', methods=['POST'])
def get_spectral_indexes():
    try:
        start_date = request.args.get('startDate')
        end_date = request.args.get('endDate')
        
        aoi_file = request.files['aoiDataFiles']

        print(f"Fetching image from {start_date} to {end_date}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            aoi_filepath = os.path.join(temp_dir, secure_filename(aoi_file.filename))

        # Directorio base donde se encuentra el script

        # Ruta al archivo shapefile
            aoi_file.save(aoi_filepath)

            gdf = gpd.read_file(aoi_filepath)
            geojson_dict = gdf.__geo_interface__
            bbox = ee.FeatureCollection(geojson_dict['features'])   
                
        
            coleccion_sentinel = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")\
                .filterDate(start_date, end_date)\
                .filterBounds(bbox)\
                .filterMetadata('CLOUDY_PIXEL_PERCENTAGE', 'less_than', 10)
                
            mosaico = coleccion_sentinel.median().clip(bbox)
                
            mosaico_bands = mosaico.select(['B4', 'B3', 'B2', 'B11', 'B1', 'B12', 'B8', 'B5'])
            
            def calculate_ndvi(image):
                # Calcular NDVI usando la expresión
                ndvi = image.expression(
                    'float((NIR - RED) / (NIR + RED))', {
                    'NIR': image.select('B8'),
                    'RED': image.select('B4')
                }).rename('NDVI')  # Renombrar como 'NDVI'
                
                # Imprimir NDVI (opcional, principalmente para debugging o exploración)
                
                return ndvi
            
            def calculate_evi(image):
                return image.expression(
                    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
                        'NIR': image.select('B8'),
                        'RED': image.select('B4'),
                        'BLUE': image.select('B2')
                    }).rename('EVI')
                
            def calculate_gndvi(image):
                gndvi = image.expression(
                    '(NIR - GREEN) / (NIR + GREEN)', 
                    {
                        'NIR': image.select('B8'),  
                        'GREEN': image.select('B3')
                    }).rename('GNDVI')
                return gndvi
            
            def add_indices(image):
                indices = [
                    calculate_ndvi(image), calculate_evi(image), calculate_gndvi(image)
                ]
                return image.addBands(indices)


            composite_indices = add_indices(mosaico_bands)
            
            band = request.args.get('indexType')
            
            composite_clipped = []
            
            if band=="NDVI" :
                composite_clipped = composite_indices.clip(bbox).select("NDVI")
                
            elif band=="GNDVI":
                composite_clipped = composite_indices.clip(bbox).select("GNDVI")

                
            elif band=="EVI":
                composite_clipped = composite_indices.clip(bbox).select("EVI")
            

            palette = [
            'a50026', 'd73027', 'f46d43', 'fdae61', 'fee08b',
            'ffffbf', 'd9ef8b', 'a6d96a', '66bd63', '1a9850', '006837'
            ]
            visualization_parameters = {
            'min': 0.3, 'max': 0.8,  'palette':  palette
                }
            
            map_id = composite_clipped.getMapId(visualization_parameters)
            
                
        return jsonify({"success": True, "output": map_id['tile_fetcher'].url_format}), 200

    except Exception as e:
        print(str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/spatiotemporal_analysis', methods=['POST'])  
def get_spatiotemporal_analysis():
    try:
        if 'aoiDataFiles' not in request.files:
            return jsonify({"error": "No file part"}), 400

        aoi_file = request.files['aoiDataFiles']

        if aoi_file.filename == '':
            return jsonify({"error": "No selected file"}), 400
        with tempfile.TemporaryDirectory() as temp_dir:
            aoi_filepath = os.path.join(temp_dir, secure_filename(aoi_file.filename))

            aoi_file.save(aoi_filepath)

            # Suponiendo que el shapefile se extrae en el directorio temporal
                        
            gdf = gpd.read_file(aoi_filepath)
            geojson_dict = gdf.__geo_interface__
            aoi = ee.FeatureCollection(geojson_dict['features'])
            
            startdate = '2001-01-01'
            enddate = '2023-12-31'
            df_result=None

            var = request.form['varType']
            
            if var == "LST":
                #-----------------------------MODIS NPP AGB-----------------------------------#

                # Cargar las colecciones de imágenes MODIS NPP y GPP
                npp = ee.ImageCollection('MODIS/061/MOD17A3HGF')
                gpp = ee.ImageCollection("MODIS/006/MYD17A2H")

                # Filtrar las colecciones por fecha y límites, y seleccionar las bandas relevantes
                nppCollection = npp.filterDate(startdate, enddate).filterBounds(aoi).select("Npp")
                gppCollection = gpp.filterDate(startdate, enddate).filterBounds(aoi).select("Gpp")

                # Filtrar las colecciones para asegurarse de la presencia de las bandas específicas
                nppfilteredCollection = nppCollection.filter(ee.Filter.listContains('system:band_names', 'Npp'))
                gppfilteredCollection = gppCollection.filter(ee.Filter.listContains('system:band_names', 'Gpp'))

                # Función para calcular NPP8
                def myNpp(myimg):
                    d = ee.Date(myimg.get('system:time_start'))
                    y = d.get('year').toInt()

                    GPPy = gppfilteredCollection.filter(ee.Filter.calendarRange(y, y, 'year')).sum()
                    NPPy = nppfilteredCollection.filter(ee.Filter.calendarRange(y, y, 'year')).mean()

                    npp8 = myimg.expression('(GGP8 / GPPy) * NPPy', {
                        'GGP8': myimg,
                        'GPPy': GPPy,
                        'NPPy': NPPy
                    }).multiply(0.0001)

                    return npp8.copyProperties(myimg, ['system:time_start'])

                # Aplicar la función a la colección de GPP
                npp8Collection = gppCollection.map(myNpp)


                #-------------------------------LST MODIS-----------------------------------#

                # Cargar la colección MODIS LST
                lst = ee.ImageCollection("MODIS/061/MOD11A2").select('LST_Day_1km')

                # Filtrar la colección LST por fecha y límites
                lstCollection = lst.filterDate(startdate, enddate).filterBounds(aoi).select("LST_Day_1km")

                # Función para calcular LST mensual
                def myLst(myimg):
                    d = ee.Date(myimg.get('system:time_start'))
                    y = d.get('year').toInt()
                    m = d.get('month').toInt()

                    LSTm = lstCollection.filter(ee.Filter.calendarRange(y, y, 'year')).filter(ee.Filter.calendarRange(m, m, 'month')).mean()

                    return LSTm.copyProperties(myimg, ['system:time_start'])

                # Aplicar la función a la colección de LST para obtener LST mensual
                monthlyLSTCollection = lstCollection.map(myLst)
                
                # Filtrar las colecciones para valores válidos y crear gráficos
                filteredFeaturesLST = monthlyLSTCollection.filterDate('2003-01-01', '2021-12-31').map(
                    lambda image: ee.Feature(None, {
                        'Date': ee.Date(image.get('system:time_start')).format('YYYY-MM'),
                        'LST': image.reduceRegion(ee.Reducer.firstNonNull(), aoi, 30).get('LST_Day_1km')
                    })
                ).filter(ee.Filter.notNull(['LST']))
                
                features_list = filteredFeaturesLST.getInfo()['features']
                data = [feature['properties'] for feature in features_list]

                # Crear un DataFrame de pandas
                df = pd.DataFrame(data)

                # Convertir la columna de fecha a un tipo datetime
                df['Date'] = pd.to_datetime(df['Date'])

                # Filtrar valores nulos
                df = df.dropna()
                
                df_pivot = df.pivot_table(index='Date', values='LST', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'LST': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result=df_json
                
                
            elif var =="PRECIPT":
                # ----------------------------------- CHIRPS (Precipitación) -----------------------------------

                # Cargar la colección CHIRPS de precipitación diaria
                chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").select('precipitation')

                # Filtrar la colección por fecha y límites
                chirpsCollection = chirps.filterDate(startdate, enddate).filterBounds(aoi)

                # Función para agrupar y calcular la precipitación mensual
                def calculateMonthlyPrecipitation(year, month):
                    monthly_precipitation = chirpsCollection.filter(ee.Filter.calendarRange(year, year, 'year')) \
                                                            .filter(ee.Filter.calendarRange(month, month, 'month')) \
                                                            .mean()
                    return monthly_precipitation.set('year', year).set('month', month)

                # Generar una lista de años y meses
                years = ee.List.sequence(2001, 2021)
                months = ee.List.sequence(1, 12)

                # Aplicar la función para calcular precipitación mensual
                monthlyPrecipitationCollection = ee.ImageCollection(
                    years.map(lambda y: months.map(lambda m: calculateMonthlyPrecipitation(y, m))).flatten()
                )

                # Reducir la colección a valores medios dentro del AOI
                def reduceToFeature(image):
                    precipitation = image.reduceRegion(
                        reducer=ee.Reducer.mean(), geometry=aoi, scale=5000
                    ).get('precipitation')
                    return ee.Feature(None, {
                        'Date': ee.Date.fromYMD(image.get('year'), image.get('month'), 1).format('YYYY-MM'),
                        'Precipitation': precipitation
                    })

                # Reducir y convertir en un DataFrame
                filteredFeaturesPrecipitation = monthlyPrecipitationCollection.map(reduceToFeature).filter(ee.Filter.notNull(['Precipitation']))

                features_list_Precipitation = filteredFeaturesPrecipitation.getInfo()['features']
                data_Precipitation = [feature['properties'] for feature in features_list_Precipitation]
                df_Precipitation = pd.DataFrame(data_Precipitation)
                df_Precipitation['Date'] = pd.to_datetime(df_Precipitation['Date'])
                df_Precipitation = df_Precipitation.dropna()
                df_pivot = df_Precipitation.pivot_table(index='Date', values='Precipitation', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'Precipitation': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result=df_json
                
            elif var=="EVI":
                # Cargar la colección MODIS EVI
                evi = ee.ImageCollection("MODIS/061/MOD13A1").select('EVI')

                # Filtrar la colección de EVI por fecha y límites
                eviCollection = evi.filterDate(startdate, enddate).filterBounds(aoi)

                # Función para calcular la EVI media mensual
                def calculateMonthlyEVI(image):
                    return image.set('system:time_start', image.date().format('YYYY-MM')).set('EVI', image.reduceRegion(ee.Reducer.mean(), aoi, 30).get('EVI'))

                # Aplicar la función a la colección EVI
                monthlyEVICollection = eviCollection.map(calculateMonthlyEVI)

                # Filtrar y convertir en un DataFrame
                filteredFeaturesEVI = monthlyEVICollection.map(
                    lambda image: ee.Feature(None, {
                        'Date': ee.Date(image.get('system:time_start')).format('YYYY-MM'),
                        'EVI': image.get('EVI')
                    })
                ).filter(ee.Filter.notNull(['EVI']))

                features_list_EVI = filteredFeaturesEVI.getInfo()['features']
                data_EVI = [feature['properties'] for feature in features_list_EVI]
                df_EVI = pd.DataFrame(data_EVI)
                df_EVI['Date'] = pd.to_datetime(df_EVI['Date'])
                df_EVI = df_EVI.dropna()
                df_pivot = df_EVI.pivot_table(index='Date', values='EVI', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'EVI': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result=df_json
                
            elif var=="NDVI":
                # Cargar la colección MODIS NDVI
                ndvi = ee.ImageCollection("MODIS/061/MOD13A1").select('NDVI')

                # Filtrar la colección de NDVI por fecha y límites
                ndviCollection = ndvi.filterDate(startdate, enddate).filterBounds(aoi)

                # Función para calcular la NDVI media mensual
                def calculateMonthlyNDVI(image):
                    return image.set('system:time_start', image.date().format('YYYY-MM')).set('NDVI', image.reduceRegion(ee.Reducer.mean(), aoi, 30).get('NDVI'))

                # Aplicar la función a la colección NDVI
                monthlyNDVICollection = ndviCollection.map(calculateMonthlyNDVI)

                # Filtrar y convertir en un DataFrame
                filteredFeaturesNDVI = monthlyNDVICollection.map(
                    lambda image: ee.Feature(None, {
                        'Date': ee.Date(image.get('system:time_start')).format('YYYY-MM'),
                        'NDVI': image.get('NDVI')
                    })
                ).filter(ee.Filter.notNull(['NDVI']))

                features_list_NDVI = filteredFeaturesNDVI.getInfo()['features']
                data_NDVI = [feature['properties'] for feature in features_list_NDVI]
                df_NDVI = pd.DataFrame(data_NDVI)
                df_NDVI['Date'] = pd.to_datetime(df_NDVI['Date'])
                df_NDVI = df_NDVI.dropna()
                df_pivot = df_NDVI.pivot_table(index='Date', values='NDVI', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'NDVI': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result=df_json

            elif var=="TSAVI":
                # Cargar la colección Sentinel-2
                s = 1.0  # Ejemplo de valor, ajusta según tu región
                a = 0.0  # Ejemplo de valor, ajusta según tu región
                X = 0.08  # Parámetro de ajuste

                sentinel2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED").filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).select(['B4', 'B8'])

                # Definir el período de análisis
                startdate_s2 = '2015-06-23'  # Fecha de inicio para Sentinel-2
                enddate_s2 = '2021-12-31'

                # Filtrar la colección Sentinel-2 por fecha y límites
                sentinel2Collection = sentinel2.filterDate(startdate_s2, enddate_s2).filterBounds(aoi)

                # Función para calcular TSAVI
                def calculateTSAVI(image):
                    tsavi = image.expression(
                        '((s * (NIR - s * Red - a)) / (s * NIR + Red - s * a + X))', {
                            'NIR': image.select('B8'),
                            'Red': image.select('B4'),
                            's': s,
                            'a': a,
                            'X': X
                        }).rename('TSAVI')
                    return image.addBands(tsavi).set('system:time_start', image.date().format('YYYY-MM'))

                # Aplicar la función a la colección TSAVI
                tsaviCollection = sentinel2Collection.map(calculateTSAVI)

                # Filtrar y convertir en un DataFrame
                filteredFeaturesTSAVI = tsaviCollection.map(
                    lambda image: ee.Feature(None, {
                        'Date': ee.Date(image.get('system:time_start')).format('YYYY-MM'),
                        'TSAVI': image.select('TSAVI').reduceRegion(ee.Reducer.mean(), aoi, 30).get('TSAVI')
                    })
                ).filter(ee.Filter.notNull(['TSAVI']))

                features_list_TSAVI = filteredFeaturesTSAVI.getInfo()['features']
                data_TSAVI = [feature['properties'] for feature in features_list_TSAVI]
                df_TSAVI = pd.DataFrame(data_TSAVI)
                df_TSAVI['Date'] = pd.to_datetime(df_TSAVI['Date'])
                df_TSAVI = df_TSAVI.dropna()
                df_pivot = df_TSAVI.pivot_table(index='Date', values='TSAVI', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'TSAVI': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result = df_json
                
            elif var=="MSI":
                # Cargar la colección Sentinel-2 para MSI
                sentinel2_msi = ee.ImageCollection("COPERNICUS/S2_HARMONIZED").filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)).select(['B8', 'B11'])

                # Filtrar la colección Sentinel-2 por fecha y límites para MSI
                sentinel2Collection_msi = sentinel2_msi.filterDate(startdate_s2, enddate_s2).filterBounds(aoi)

                # Función para calcular MSI
                def calculateMSI(image):
                    msi = image.expression(
                        'SWIR / NIR', {
                            'SWIR': image.select('B11'),
                            'NIR': image.select('B8')
                        }).rename('MSI')
                    return image.addBands(msi).set('system:time_start', image.date().format('YYYY-MM'))

                # Aplicar la función a la colección MSI
                msiCollection = sentinel2Collection_msi.map(calculateMSI)

                # Filtrar y convertir en un DataFrame
                filteredFeaturesMSI = msiCollection.map(
                    lambda image: ee.Feature(None, {
                        'Date': ee.Date(image.get('system:time_start')).format('YYYY-MM'),
                        'MSI': image.select('MSI').reduceRegion(ee.Reducer.mean(), aoi, 30).get('MSI')
                    })
                ).filter(ee.Filter.notNull(['MSI']))

                features_list_MSI = filteredFeaturesMSI.getInfo()['features']
                data_MSI = [feature['properties'] for feature in features_list_MSI]
                df_MSI = pd.DataFrame(data_MSI)
                df_MSI['Date'] = pd.to_datetime(df_MSI['Date'])
                df_MSI = df_MSI.dropna()
                df_pivot = df_MSI.pivot_table(index='Date', values='MSI', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'MSI': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result = df_json
                      
            elif var=="ABVGRND_CARBON":
                                # Cargar las colecciones de imágenes MODIS NPP y GPP
                npp = ee.ImageCollection('MODIS/061/MOD17A3HGF').select('Npp')
                gpp = ee.ImageCollection("MODIS/006/MYD17A2H").select('Gpp')

                # Filtrar las colecciones por fecha y límites
                nppCollection = npp.filterDate(startdate, enddate).filterBounds(aoi)
                gppCollection = gpp.filterDate(startdate, enddate).filterBounds(aoi)

                # Función para calcular NPP8 (Carbono sobre el suelo)
                def calculateNpp8(image):
                    # Extraer la fecha de la imagen
                    date = ee.Date(image.get('system:time_start'))
                    year = date.get('year')

                    # Filtrar las colecciones GPP y NPP para el año específico
                    GPPy = gppCollection.filter(ee.Filter.calendarRange(year, year, 'year')).sum()
                    NPPy = nppCollection.filter(ee.Filter.calendarRange(year, year, 'year')).mean()

                    # Calcular npp8 usando una expresión
                    npp8 = GPPy.expression(
                        '(GGP8 / GPPy) * NPPy',
                        {
                            'GGP8': image.select('Gpp'),
                            'GPPy': GPPy.select('Gpp'),
                            'NPPy': NPPy.select('Npp')
                        }
                    ).multiply(0.0001)

                    # Añadir propiedades para mantener la consistencia
                    return npp8.set({
                        'system:time_start': image.get('system:time_start'),
                        'year': year
                    })

                # Aplicar la función sobre la colección GPP
                npp8Collection = gppCollection.map(calculateNpp8)

                # Reducir la colección a valores medios dentro del AOI
                # Reducir la colección a valores medios dentro del AOI
                def reduceToFeature(image):
                    # Reducir la región para obtener el valor medio
                    carbon_dict = image.reduceRegion(
                        reducer=ee.Reducer.mean(), geometry=aoi, scale=5000
                    )

                    # Verificar si 'Gpp' está presente en el resultado
                    carbon = ee.Algorithms.If(
                        carbon_dict.contains('Gpp'),
                        carbon_dict.get('Gpp'),
                        ee.Algorithms.If(
                            carbon_dict.contains('Npp'),
                            carbon_dict.get('Npp'),
                            None  # Si ninguna de las claves está presente, devolver None
                        )
                    )

                    # Devolver la imagen con la propiedad 'Carbon'
                    return image.set('Carbon', carbon)

                # Aplicar la reducción y filtrar valores nulos en el servidor
                npp8CollectionWithCarbon = npp8Collection.map(reduceToFeature).filter(ee.Filter.notNull(['Carbon']))

                # Continuar con el procesamiento como antes

                # Traer los datos al lado del cliente
                features_list_Carbon = npp8CollectionWithCarbon.getInfo()['features']
                data_Carbon = [feature['properties'] for feature in features_list_Carbon]

                # Crear el DataFrame
                df_Carbon = pd.DataFrame(data_Carbon)

                # Verifica si 'Date' está en las columnas antes de intentar la conversión
                if 'system:time_start' in df_Carbon.columns:
                    df_Carbon['Date'] = pd.to_datetime(df_Carbon['system:time_start'], unit='ms')
                else:
                    print("Error: La columna 'system:time_start' no está presente en el DataFrame.")

                # Filtrar filas con valores nulos
                df_Carbon = df_Carbon.dropna()
                df_pivot = df_Carbon.pivot_table(index='Date', values='Carbon', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'Carbon': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result = df_json
                
            elif var=="TREE_COVER":
                
                # Cargar la colección MODIS Percent Tree Cover
                cover = ee.ImageCollection('MODIS/006/MOD44B').select('Percent_Tree_Cover')

                # Filtrar la colección Percent Tree Cover por fecha y límites
                coverCollection = cover.filterDate(startdate, enddate).filterBounds(aoi)

                # Función para calcular la cobertura arbórea media mensual
                def calculateMonthlyTreeCover(year, month):
                    monthly_cover = coverCollection.filter(ee.Filter.calendarRange(year, year, 'year')) \
                                                .filter(ee.Filter.calendarRange(month, month, 'month')) \
                                                .mean()
                    return monthly_cover.set('year', year).set('month', month)

                # Generar una lista de años y meses
                years = ee.List.sequence(2001, 2023)
                months = ee.List.sequence(1, 12)

                # Aplicar la función para calcular cobertura arbórea mensual
                def map_over_months(year):
                    return months.map(lambda month: calculateMonthlyTreeCover(year, month))

                # Mapear sobre los años y aplanar la colección
                monthlyCoverCollection = ee.ImageCollection(years.map(map_over_months).flatten())

                # Reducir la colección a valores medios dentro del AOI
                def reduceToFeature(image):
                    # Verificar si la clave 'Percent_Tree_Cover' está presente en los datos
                    dict_keys = image.reduceRegion(
                        reducer=ee.Reducer.mean(), geometry=aoi, scale=5000
                    ).keys()

                    # Solo continuar si 'Percent_Tree_Cover' está presente
                    def createFeature(valid):
                        return ee.Algorithms.If(
                            valid,
                            ee.Feature(None, {
                                'Date': ee.Date.fromYMD(image.get('year'), image.get('month'), 1).format('YYYY-MM'),
                                'Percent_Tree_Cover': image.reduceRegion(
                                    reducer=ee.Reducer.mean(), geometry=aoi, scale=5000
                                ).get('Percent_Tree_Cover')
                            }),
                            ee.Feature(None, {})
                        )

                    return ee.Feature(createFeature(dict_keys.contains('Percent_Tree_Cover')))

                # Filtrar y convertir en un DataFrame
                filteredFeaturesCover = monthlyCoverCollection.map(reduceToFeature).filter(ee.Filter.notNull(['Percent_Tree_Cover']))

                features_list_Cover = filteredFeaturesCover.getInfo()['features']
                data_Cover = [feature['properties'] for feature in features_list_Cover]
                df_Cover = pd.DataFrame(data_Cover)
                df_Cover['Date'] = pd.to_datetime(df_Cover['Date'])
                df_Cover = df_Cover.dropna()
                df_pivot = df_Cover.pivot_table(index='Date', values='Percent_Tree_Cover', aggfunc='mean').reset_index()
                df_pivot = df_pivot.rename(columns={'Percent_Tree_Cover': 'Value', 'Date': 'Date'})  # Renombrar columnas
                df_json_str = df_pivot.to_json(orient='records')
                df_json = json.loads(df_json_str)
                df_result=df_json
                
            print(df_result)
            
            return jsonify({
                "success": True,
                "output": df_result[0]
            }), 200

    except Exception as e:
        print(str(e))
        return jsonify({"error": str(e)}), 500

    


if __name__ == '__main__':
    app.run(port=5005)
