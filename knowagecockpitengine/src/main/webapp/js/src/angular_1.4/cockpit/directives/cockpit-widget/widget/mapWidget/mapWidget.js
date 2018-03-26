/*
Knowage, Open Source Business Intelligence suite
Copyright (C) 2016 Engineering Ingegneria Informatica S.p.A.

Knowage is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

Knowage is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
(function() {
	angular
		.module('cockpitModule')
		.directive('cockpitMapWidget',function(){
			return{
				templateUrl: baseScriptPath+ '/directives/cockpit-widget/widget/mapWidget/templates/mapWidgetTemplate.html',
				controller: cockpitMapWidgetControllerFunction,
				compile: function (tElement, tAttrs, transclude) {
					return {
						pre: function preLink(scope, element, attrs, ctrl, transclud) {
						},
						post: function postLink(scope, element, attrs, ctrl, transclud) {
							element.ready(function () {
								scope.initWidget();
								scope.createMap();
							});
						}
					};
				}
			}
		})

	function cockpitMapWidgetControllerFunction(
			$scope,
			$mdDialog,
			$mdToast,
			$timeout,
			$mdPanel,
			$mdSidenav,
			$q,
			$sce,
			$filter,
			$location,
			sbiModule_translate,
			sbiModule_messaging,
			sbiModule_restServices,
			cockpitModule_mapServices,
			cockpitModule_datasetServices,
			cockpitModule_generalServices,
			cockpitModule_widgetConfigurator,
			cockpitModule_widgetServices,
			cockpitModule_widgetSelection,
			cockpitModule_properties){
		
		//ol objects
		$scope.layers = [];  //layers with features
		$scope.values = [];  //layers with values
		$scope.configs = []; //layers with configuration
		

		$scope.getTemplateUrl = function(template){
	  		return cockpitModule_generalServices.getTemplateUrl('mapWidget',template);
	  	}

	    $scope.reinit = function(){
	    	var isNew = ($scope.layers.length == 0);
	    	for (l in $scope.ngModel.content.layers){
	    		//remove old layers 
	    		var previousLayer = $scope.getLayerByName($scope.ngModel.content.layers[l].name);
	    		if (previousLayer) $scope.map.removeLayer(previousLayer); //ol obj  		
	    	}
	    	$scope.removeLayers(); //clean internal obj
	    	$scope.getLayers();
	    	
	    	if (isNew) $scope.createMap();

	    	if (!$scope.map.getSize()){
    			$scope.map.setSize([cockpitModule_widgetConfigurator.map.initialDimension.width, 
    							    cockpitModule_widgetConfigurator.map.initialDimension.height]);
    		}else{
    			$scope.map.setSize($scope.map.getSize());
    		}
			$scope.map.renderSync();
        }
	    
	    $scope.optionsSidenavOpened = false;
		$scope.toggleSidenav = function(){
			$scope.optionsSidenavOpened = !$scope.optionsSidenavOpened;
			$timeout(function() {
				$scope.map.updateSize();
			}, 500);
		}

	    $scope.refresh = function(element,width,height, data, nature, associativeSelection, changedChartType, chartConf, options) {
    		var dsLabel = (Array.isArray(options.label)) ? options.label[0] : options.label; //on delete of selections options is an array !!!
    		$scope.createLayerWithData(dsLabel, data);
	    }
	    
	    $scope.getOptions =function(){
			var obj = {};
			obj["type"] = $scope.ngModel.type;
			return obj;
		}
	    
	    $scope.editWidget=function(index){
			var finishEdit=$q.defer();
			var config = {
					attachTo:  angular.element(document.body),
					controller: mapWidgetEditControllerFunction,
					disableParentScroll: true,
					templateUrl: $scope.getTemplateUrl('mapWidgetEditPropertyTemplate'),
					position: $mdPanel.newPanelPosition().absolute().center(),
					fullscreen :true,
					hasBackdrop: true,
					clickOutsideToClose: true,
					escapeToClose: false,
					focusOnOpen: true,
					preserveScope: false,
					locals: {finishEdit:finishEdit,model:$scope.ngModel},
			};
			$mdPanel.open(config);
			return finishEdit.promise;
		}
	    
//############################################## SPECIFIC MAP WIDGET METHODS #########################################################################
	    
	    $scope.getLayers = function () {
		    for (l in $scope.ngModel.content.layers){
		    	var layerDef =  $scope.ngModel.content.layers[l];
	    		$scope.setConfigLayer(layerDef.name, layerDef);
	    		if (layerDef.type === 'DATASET'){
	    			$scope.getFeaturesFromDataset(layerDef);
	    		}else if (layerDef.type === 'CATALOG'){
	    			//TODO implementare recupero layer da catalogo
	    		}else{
	    			sbiModule_messaging.showInfoMessage(sbiModule_translate.load('sbi.cockpit.map.typeLayerNotManaged'), 'Title', 3000);
	    			console.log("Layer with type ["+layerDef.type+"] not managed! ");
	    		}
	    	}
	    }

	    $scope.initializeTemplate = function (){
	    	if (!$scope.ngModel.content.currentView)  $scope.ngModel.content.currentView = {};
	    	if (!$scope.ngModel.content.layers) $scope.ngModel.content.layers = [];
	    	if (!$scope.ngModel.content.baseLayersConf) $scope.ngModel.content.baseLayersConf = [];
	    	if (!$scope.ngModel.content.columnSelectedOfDataset) $scope.ngModel.content.columnSelectedOfDataset = {} ;

	    	if (!$scope.ngModel.content.currentView.center) $scope.ngModel.content.currentView.center = [0,0]; 
	    	
	    	if (!$scope.ngModel.content.mapId){
	    		$scope.ngModel.content.mapId = 'map-' + Math.ceil(Math.random()*1000).toString();
	    	}	    	
	    	
	    	//set default indicator (first one) for each layer
	    	for (l in $scope.ngModel.content.layers){
	    		var columns = $scope.getColumnSelectedOfDataset($scope.ngModel.content.layers[l].dsId);
	    		for ( c in columns){
	    			if (columns[c].properties.showMap){
	    				$scope.ngModel.content.layers[l].defaultIndicator = columns[c].aliasToShow;	
	    				break;
	    			}
	    		}
	    	}	
	    }
	    
	    $scope.createLayerWithData = function(label, data){
	    	//prepare object with metadata for desiderata dataset columns
	    	var geoColumn = null;
	    	var selectedMeasure = null;
    		var columnsForData = [];
    		var layerDef =  $scope.getConfigLayer(label);
    		var columnsForData = $scope.getColumnSelectedOfDataset(layerDef.dsId) || [];
    		
    		//remove old layer
    		var previousLayer = $scope.getLayerByName(label);
    		if (previousLayer) $scope.map.removeLayer(previousLayer); //ol obj
    		$scope.removeLayer(label);
    		
    		for (f in columnsForData){
    			var tmpField = columnsForData[f];
    			if (tmpField.fieldType == "SPATIAL_ATTRIBUTE")
    				geoColumn = tmpField.name;
    			else if (tmpField.properties.showMap) //first measure
    				selectedMeasure = tmpField.aliasToShow;
    		}  
    		
    		var featuresSource = cockpitModule_mapServices.getFeaturesDetails(geoColumn, selectedMeasure, layerDef, columnsForData, data);
			if (featuresSource == null){ 
				return;
			}
			cockpitModule_mapServices.setActiveConf(layerDef.name, layerDef);
			var layer;
			
			if (layerDef.markerConf && layerDef.markerConf.type == 'cluster'){
				var clusterSource = new ol.source.Cluster({source: featuresSource	
														  });
				layer =  new ol.layer.Vector({source: clusterSource,
										  	  style: cockpitModule_mapServices.layerStyle
											});
			}else{
				layer = new ol.layer.Vector({source: featuresSource,
	    									 style: cockpitModule_mapServices.layerStyle
	    									});
			}

			//add decoration to layer element			
			layer.name = layerDef.name;
			layer.dsId = layerDef.dsId;
			layer.setZIndex(layerDef.order*1000);
			$scope.map.addLayer(layer); 			//add layer to ol.Map
			$scope.addLayer(layerDef.name, layer);	//add layer to internal object
			$scope.setLayerProperty (layerDef.name, 'geoColumn',geoColumn),
			$scope.setValuesLayer(layerDef.name, data); //add values to internal object
			cockpitModule_mapServices.updateCoordinatesAndZoom($scope.ngModel, $scope.map, layer, true);	
	    }
	    
	    
	    $scope.getColumnSelectedOfDataset = function(dsId) {
	    	for (di in $scope.ngModel.content.columnSelectedOfDataset){
	    		if (di == dsId){
	    			return $scope.ngModel.content.columnSelectedOfDataset[di];
	    		}
	    	}
	    	return null;
	    }
	    
	    $scope.addViewEvents = function(){
	    	//view events
	    	var view = $scope.map.getView();
            view.on("change:resolution", function(e) {
            	//zoom action
//        	    if (Number.isInteger(e.target.getZoom())) {
//        	    }
        	    $scope.ngModel.content.currentView.zoom = e.target.getZoom();
        	    $scope.ngModel.content.currentView.center = e.target.getCenter();
            });

	    }

	    $scope.addMapEvents = function (overlay){
	    	//Elements that make up the popup.
            var popupContent = document.getElementById('popup-content');
            var closer = document.getElementById('popup-closer');
            
            if (closer){
	            closer.onclick = function() {
	              overlay.setPosition(undefined);
	              closer.blur();
	              return false;
	            };
            }else
            	console.log("<div> with identifier 'popup-closer' doesn't found !!! It isn't impossible set the popup detail content ");

    		$scope.map.on('singleclick', function(evt) {
    			//popup detail
    			if (!popupContent){
    				console.log("<div> with identifier 'popup-content' doesn't found !!! It isn't impossible set the popup detail content ");
    				return;
    			}
    				
            	var feature = $scope.map.forEachFeatureAtPixel(evt.pixel,
            	            function(feature, layer) {
//            	                console.log("feature on click: ",feature);
            	                return feature;
            	            });
            	var layer = $scope.map.forEachFeatureAtPixel(evt.pixel,
        	            function(feature, layer) {

        	                return layer;
        	            });

    	        if (feature) {
    	            var geometry = feature.getGeometry();
    	            var props = feature.getProperties();
    	            var coordinate = geometry.getCoordinates();
    	            var config = $scope.getColumnSelectedOfDataset(layer.dsId);
    	            var text = "";
    	            for (var p in props){
    	            	if ($scope.isDisplayableProp(p, config))
    	            	text += '<b>' + p + ":</b> " + props[p].value + '<br>';
    	            }

    		        popupContent.innerHTML = '<h2>Details</h2><code>' + text + '</code>';
    		        overlay.setPosition(coordinate);
    	        }
             });

    		// change mouse cursor when over marker
    	      $scope.map.on('pointermove', function(e) {
    	    	  var pixel = $scope.map.getEventPixel(e.originalEvent);
    	    	  var hit = $scope.map.hasFeatureAtPixel(pixel);
    	    	  $scope.map.getViewport().style.cursor = hit ? 'pointer' : '';
    	      });

    		$scope.map.on('moveend', function(evt){
    			var view = $scope.map.getView();
    			if (!$scope.ngModel.content.currentView) $scope.ngModel.content.currentView = {};
    			$scope.ngModel.content.currentView.center = view.getCenter();
    			$scope.ngModel.content.currentView.zoom = view.getZoom();
    		});
	    }

	    $scope.isDisplayableProp = function (p, config){
	    	for (c in config){
	    		if (p == config[c].aliasToShow && config[c].properties.showDetails){
	    			return true;
	    		}
	    	}
	    	return false;
	    }
		
	    $scope.getFeaturesFromDataset = function(layerDef){
    		//prepare object with metadata for desiderata dataset columns
	    	var geoColumn = null;
    		var selectedMeasure = null;
    		var columnsForData = [];
    		
    		var columnsForData = $scope.getColumnSelectedOfDataset(layerDef.dsId) || [];
	    	
    		for (f in columnsForData){
    			var tmpField = columnsForData[f];
    			if (tmpField.fieldType == "SPATIAL_ATTRIBUTE")
    				geoColumn = tmpField.name;
    			else if (tmpField.properties.showMap) 	//first measure
    				selectedMeasure = tmpField.aliasToShow;
    		}    	
    		
    		var model = {content: {columnSelectedOfDataset: columnsForData }};
    		var features = [];
    		var layer =  new ol.layer.Vector();

    		//get the dataset columns values
	    	cockpitModule_datasetServices.loadDatasetRecordsById(layerDef.dsId, undefined, undefined, undefined, undefined, model).then(
	    		function(allDatasetRecords){
	    			$scope.createLayerWithData(layerDef.name, allDatasetRecords);
			},function(error){
				console.log("Error loading dataset with id [ "+layerDef.dsId+"] "); 
				sbiModule_messaging.showInfoMessage($scope.translate.load('sbi.cockpit.map.datasetLoadingError').replace("{0}",layerDef.dsId), 'Title', 3000);
			});	
    	}

	    $scope.createMap = function (){
	    	$scope.initializeTemplate();
	    	
	    	//create the base layer
            $scope.baseLayer = cockpitModule_mapServices.getBaseLayer($scope.ngModel.content.baseLayersConf[0]);

	    	//setting coordinates (from the first layer if they aren't setted into the template)
            if ($scope.ngModel.content.currentView.center[0] == 0 && $scope.ngModel.content.currentView.center[1] == 0 && $scope.layers.length > 0){
	    		var tmpLayer = $scope.layers[0].layer;
	    		cockpitModule_mapServices.updateCoordinatesAndZoom($scope.ngModel, $scope.map, tmpLayer, false);

	    		$scope.addViewEvents();
	    		$scope.addMapEvents(overlay);
    		}
    		
            var popupContainer = document.getElementById('popup');
            //create overlayers (popup..)
            var overlay = new ol.Overlay({
	              element: popupContainer,
	              autoPan: true,
	              autoPanAnimation: {
	                duration: 250
	              }
            });
    		$scope.map = new ol.Map({
    		  target:  $scope.ngModel.content.mapId,
    		  layers: [ $scope.baseLayer ],
    		  overlays: [overlay],
    		  view: new ol.View({
    		    center: $scope.ngModel.content.currentView.center,
    		    zoom:  $scope.ngModel.content.currentView.zoom || 3
    		  })
    		});
    		
    		//add events methods
    		$scope.addViewEvents();
    		$scope.addMapEvents(overlay);
    		
    		//just for refresh
    		if (!$scope.map.getSize()){
    			$scope.map.setSize([cockpitModule_widgetConfigurator.map.initialDimension.width, 
    							    cockpitModule_widgetConfigurator.map.initialDimension.height]);
    		}else{
    			$scope.map.setSize($scope.map.getSize());
    		}
			$scope.map.renderSync();
	    }
	    
	    //control panel events
	    $scope.toggleLayer = function(e,n){
	    	e.stopPropagation();
	    	var l = $scope.getLayerByName(n);
	    	if (!l) return; //do nothing
	    	var toggle = !l.getVisible();
	    	l.setVisible(!l.getVisible());
	    }
	    
	    $scope.toggleLayerExpanse = function(layer){
	    	layer.expanded = !layer.expanded;
	    }	

	    $scope.getLayerVisibility = function(n){
	    	var l = $scope.getLayerByName(n);
	    	if (!l) return; //do nothing
	    	return l.getVisible();
	    }
	    
	    $scope.getIndicatorVisibility = function(l,n){
	    	for (lpos in  $scope.ngModel.content.layers){
	    		if ( $scope.ngModel.content.layers[lpos].name == l)
		    	for (var i in $scope.ngModel.content.layers[lpos].indicators){
		    		if ($scope.ngModel.content.layers[lpos].indicators[i].label == n){
		    			return $scope.ngModel.content.layers[lpos].indicators[i].showMap || false;
		    		}
		    	}
	    	}
	    	return false;
	    }

	    //Thematization 
	    $scope.thematizeMeasure = function (l, m){
	    	var layer = $scope.getLayerByName(l);
	    	var layerValues = $scope.getValuesLayer(l).values;
	    	var layerKeyColumn =  $scope.getLayerProperty(l, 'geoColumn');
	    	var layerConfig;
	    	for (var c=0; c<$scope.ngModel.content.layers.length;c++){
	    		if ($scope.ngModel.content.layers[c].name === l){
	    			layerConfig =$scope.ngModel.content.layers[c];
	    			break;
	    		}
	    	}
	    	var layerColumnConfig = $scope.getColumnSelectedOfDataset(layerConfig.dsId) || []; 
	    	$scope.refreshStyle(layer, m, layerConfig, layerColumnConfig, layerValues, layerKeyColumn);
	    }
	    
	  //thematizer functions
	    $scope.refreshStyle = function (layer, measure, config, configColumns, values, geoColumn){
			//prepare object for thematization
	    	cockpitModule_mapServices.loadIndicatorMaxMinVal(measure, values);
			var newSource = cockpitModule_mapServices.getFeaturesDetails(geoColumn, measure, config, configColumns,  values);
			if (config.markerConf && config.markerConf.type == 'cluster'){
				var clusterSource = new ol.source.Cluster({ source: newSource });
				layer.setSource(clusterSource);
			}else{
				layer.setSource(newSource);
			}
			
			layer.getSource().refresh({force:true});
		}

	   
	    //Utility functions
	    $scope.getLayerByName = function(n){
	    	for (l in $scope.layers){
	    		if ($scope.layers[l].name === n)
	    			return $scope.layers[l].layer;
	    	}
	    	return null;
	    }
	    
	    $scope.addLayer = function(n,l){
	    	$scope.layers.push({"name": n,"layer":l});
	    }
	    
	    $scope.removeLayer = function(n){
	    	for (l in $scope.layers){
	    		if ($scope.layers[l].name == n)
	    			$scope.layers.splice(l,1);
	    	}
	    }
	    
	    $scope.removeLayers = function(){
	    	$scope.layers = [];
	    	$scope.values = [];
			$scope.configs = [];
	    }
	    
	    $scope.setLayerProperty = function(l, p, v){
	    	for (o in $scope.layers){
	    		if ($scope.layers[o].name === l)
	    			$scope.layers[o][p] = v;
	    	}
	    }  

	    $scope.setConfigLayer = function(n,c){
	    	$scope.configs.push({"name": n,"config":c});
	    }
	    
	    $scope.getConfigLayer = function(n){
	    	for (l in $scope.configs){
	    		if ($scope.configs[l].name === n)
	    			return $scope.configs[l].config;
	    	}

	    	return null;
	    }
	    
	    $scope.getValuesLayer = function (n){
	    	for (l in $scope.values){
	    		if ($scope.values[l].name === n)
	    			return $scope.values[l];
	    	}

	    	return null;
	    }
	    
	    $scope.setValuesLayer = function (n,v){
	    	$scope.values.push({"name":n, "values":v});
	    }

	    $scope.getLayerProperty = function(l, p){
	    	for (o in $scope.layers){
	    		if ($scope.layers[o].name === l)
	    			return $scope.layers[o][p] || null;
	    	}
	    }

	    $scope.setLayerProperty = function(l, p, v){
	    	for (o in $scope.layers){
	    		if ($scope.layers[o].name === l)
	    			$scope.layers[o][p] = v;
	    	}
	    }
	    
	    //functions calls
		$scope.getLayers();
	}

	// this function register the widget in the cockpitModule_widgetConfigurator factory
	addWidgetFunctionality("map",{'initialDimension':{'width':20, 'height':20},'updateble':true,'cliccable':true});
})();