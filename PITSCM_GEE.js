
// Enter study area and sample
var ROI = liupanshan;
var sample = google120.merge(google150).merge(google200).merge(google210).merge(google410).merge(google420).merge(google600);

Map.addLayer(ROI, {}, 'roi');
Map.centerObject(luoyesong,11);

// parameters 
var roiArea = ROI;
var year_start = 2020;  //Adjustments based on calculation of classification maps for different years
var year_end = 2020;   //Adjustments based on calculation of classification maps for different years
var month_start = 6;
var month_end = 9;
var compositeType = 'mean';
var S2_BANDS = ['Red','Green','Blue','NIR','SWIR1','SWIR2', 'RE1','RE2','RE3','RE4','CVI','DVI','EVI','GNDVI','GRVI','GSAVI',
                'IPVI','LAI','MSRI','MSAVI2','NDVI','NLI','OSAVI','RDVI','RVI','SAVI','SLAVI','SR','TGI','VARI','TDVI','GLI'];
var cloudPercent = 50;
var geometry = false;
var scaleSize = 10;
var sampleSplit = 0.8;

/**
 * Calculates various vegetation indices for a given region of interest (ROI) and time period.
 * This function uses Sentinel-2 satellite data to generate a composite image based on the specified parameters.
 * 
 * @param {ee.Geometry} roiArea - The region of interest (ROI) defined by a geometric shape.
 * @param {number} year_start - The starting year of the time period.
 * @param {number} year_end - The ending year of the time period.
 * @param {number} month_start - The starting month of the time period.
 * @param {number} month_end - The ending month of the time period.
 * @param {Array<string>} S2_BANDS - An array of band names for Sentinel-2 data.
 * @param {string} compositeType - The type of composite image to generate ('median', 'mean', 'min', or 'max').
 * @param {number} cloudPercent - The maximum cloud probability threshold for filtering out cloudy images.
 * @returns {ee.Image} A composite image containing various vegetation indices for the specified ROI and time period.
 */
var S2_index = function(roiArea,year_start,year_end,month_start,month_end,S2_BANDS,compositeType,cloudPercent){
  
    // set parameters for time stamp and study area
    var startYear = year_start;
    var endYear = year_end; 
    var startMonth = month_start;
    var endMonth = month_end;
    var region = roiArea;
    
    // setting temporal filter
    var criteria = ee.Filter.and(
      ee.Filter.bounds(region), 
      ee.Filter.calendarRange(startMonth,endMonth,'month'),
      ee.Filter.calendarRange(startYear,endYear,'year')
    );
    
    // Calling the S2_SR dataset
    var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') // COPERNICUS/S2_SR_HARMONIZED
                 .filter(criteria).map(maskEdges);
    
    // Calling the S2_CLOUD_PROBABILITY dataset  
    var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
                   .filter(criteria);
                   
    // Join S2 SR with cloud probability dataset to add cloud mask.
    var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
      primary: s2Sr,
      secondary: s2Clouds,
      condition:
          ee.Filter.equals({leftField: 'system:index', rightField: 'system:index'})
    });
    var s2CloudMasked = ee.ImageCollection(s2SrWithCloudMask)
                          .map(maskClouds);
    s2Sr = null;
    s2Clouds = null;
    s2SrWithCloudMask = null;
    
    var imgData = ee.Image(0);
    
    // Select composite type based on user input
    if(compositeType === 'median'){
      imgData = s2CloudMasked.median();
    }
    if (compositeType === 'mean'){
      imgData = s2CloudMasked.mean();
    }
    if (compositeType === 'min'){
      imgData = s2CloudMasked.min();
    }
    if (compositeType === 'max'){
      imgData = s2CloudMasked.max();
    }
    
    s2CloudMasked = null;
    // Generate composite image with selected indices
    var composite = compositeIndex(imgData);
    
    return composite.select(S2_BANDS);
    
    
    // The following internal functions are defined, mainly for de-cloud operations.
    function maskClouds(img){
    
      //get cloud mask based on cloud probability
      var clouds = ee.Image(img.get('cloud_mask')).select('probability');
      var isNotCloud = clouds.lt(cloudPercent);
      
      //Acquisition of cloud masks according to QA60
      var qa = img.select('QA60');
    
      // Bits 10 and 11 are clouds and cirrus, respectively.
      var cloudBitMask = 1 << 10;
      var cirrusBitMask = 1 << 11;
    
      // Both flags should be set to zero, indicating clear conditions.
      var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

      //Acquisition of cloud masks based on blue blue light bands
      var cloudMaskBYBlue = img.select('B2').lte(2000);
      
      // Cloud masking the original image
      return img.updateMask(isNotCloud).updateMask(mask).updateMask(cloudMaskBYBlue)
                .toDouble().divide(1e4)
                .copyProperties(img, ["system:time_start", "system:time_end"]);
    }
    
    // The masks for the 10m bands sometimes do not exclude bad data at
    // scene edges, so we apply masks from the 20m and 60m bands as well.
    // Example asset that needs this operation:
    // COPERNICUS/S2_CLOUD_PROBABILITY/20190301T000239_20190301T000238_T55GDP
    function maskEdges(s2_img){
      var edgeMask1 = s2_img.select('B8A').mask();
      var edgeMask2 = s2_img.select('B9').mask();
      return s2_img.updateMask(edgeMask1).updateMask(edgeMask2);
    }
    
    function compositeIndex(img){
    
      var Red = img.select('B4').rename('Red').toFloat();
      var Green = img.select('B3').rename('Green').toFloat();
      var Blue = img.select('B2').rename('Blue').toFloat();
      var NIR = img.select('B8').rename('NIR').toFloat();
      var SWIR1 = img.select('B11').rename('SWIR1').toFloat();
      var SWIR2 = img.select('B12').rename('SWIR2').toFloat();
      
      var RE1 =  img.select('B5').rename('RE1').toFloat();
      var RE2 =  img.select('B6').rename('RE2').toFloat();
      var RE3 =  img.select('B7').rename('RE3').toFloat();
      var RE4 =  img.select('B8').rename('RE4').toFloat();
      
      //  1. EVI
      var EVI = img.expression({
        expression: '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE +1))',
        map:{
          'NIR': NIR,
          'RED': Red,
          'BLUE': Blue
        }
      }).rename('EVI').toFloat();
      // 2. NDVI
      var NDVI = img.expression(
        '(NIR-Red)/(NIR+Red)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('NDVI').toFloat();
      // 3. ARVI
      var ARVI = img.expression(
        '(NIR-Red * Green)/(NIR+Red*Green)',{
            'NIR':NIR,
            'Red':Red,
            'Green':Green,
        }
      ).rename('ARVI').toFloat();
      // 4. CVI
      var CVI = img.expression(
        '(NIR*Red)/Green**2',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('CVI').toFloat();
      // 5. DVI
      var DVI = img.expression(
        'NIR-Red',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('DVI').toFloat();
      // 6. GNDVI
      var GNDVI = img.expression(
        '(NIR-Green)/(NIR+Green)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('GNDVI').toFloat();
      // 7. GRVI
      var GRVI = img.expression(
        '(NIR/Green)-1',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('GRVI').toFloat();
      // 8. GSAVI
      var GSAVI = img.expression(
        '1.5*(NIR-Green)/(NIR+Green+0.5)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('GSAVI').toFloat();
      // 9. IPVI
      var IPVI = img.expression(
        'NIR/(NIR+Red)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('IPVI').toFloat();
      // 10. LAI
      var LAI = img.expression(
        '3.618*EVI-0.118',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
            'EVI':EVI
        }
      ).rename('LAI').toFloat();
      // 11. MSRI
      var MSRI = img.expression(
        '((NIR/Red)-1)/(((NIR/Red)+1)**0.5)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('MSRI').toFloat();
      // 12. MSAVI2
      var MSAVI2 = img.expression(
        '((NIR/Red)-1-(((2*NIR+1)**2)-8*(NIR-Red))**0.5)/2',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('MSAVI2').toFloat();
      // 13.NLI
      var NLI = img.expression(
        '(NIR**2-Red)/(NIR**2+Red)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('NLI').toFloat();
      // 14. OSAVI
      var RDVI = img.expression(
        '(NIR-Red)/((NIR+Red)**0.5)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('RDVI').toFloat();
      // 15. RVI
      var RVI = img.expression(
        'Red/NIR',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('RVI').toFloat();
      // 16. SAVI
      var SAVI = img.expression(
        '1.5*(NIR-Red)/(NIR+Red+0.5)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('SAVI').toFloat();
      // 17. SLAVI
      var SLAVI = img.expression(
        'NIR/(Red+SWIR1)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('SLAVI').toFloat();
      // 18. SR
      var SR = img.expression(
        'NIR/Red',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('SR').toFloat();
      // 19. TGI
      var TGI = img.expression(
        '0.5*(0.19*(Red-Green)-0.12*(Red-Blue))',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('TGI').toFloat();
      // 20. VARI
      var VARI = img.expression(
        '(Green-Red)/(Green+Red-Blue)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('VARI').toFloat();
      var OSAVI = img.expression(
        '(NIR-Red)/(NIR+Red+0.16)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('OSAVI').toFloat();
      // 21. TDVI
      var TDVI = img.expression(
        '1.5*(NIR-Red)/((NIR**2+Red+0.5)**0.5)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('TDVI').toFloat();
      // 绿叶指数 Green leaf index(GLI)
      var GLI = img.expression(
        '(2*Green-Red-Blue)/(-Red-Blue)',{
            'Red':Red,
            'Green':Green,
            'Blue':Blue,
            'NIR':NIR,
            'SWIR1':SWIR1,
            'SWIR2':SWIR2,
        }
      ).rename('GLI').toFloat();
    
      var featureNames = ['Red','Green','Blue','NIR','SWIR1','SWIR2', 'RE1','RE2','RE3','RE4','CVI','DVI','EVI','GNDVI','GRVI','GSAVI',
                    'IPVI','LAI','MSRI','MSAVI2','NDVI','NLI','OSAVI','RDVI','RVI','SAVI','SLAVI','SR','TGI','VARI','TDVI','GLI'];
                    
      var feature = img.addBands(Red).addBands(Green).addBands(Blue).addBands(NIR).addBands(SWIR1).addBands(SWIR2).addBands(RE1).addBands(RE2)
      .addBands(RE3).addBands(RE4).addBands(CVI).addBands(DVI).addBands(EVI).addBands(GNDVI).addBands(GRVI)
                  .addBands(GSAVI).addBands(IPVI).addBands(LAI).addBands(MSRI).addBands(MSAVI2).addBands(NDVI).addBands(NLI).addBands(OSAVI).addBands(RDVI).addBands(RVI).addBands(SAVI).addBands(SLAVI)
                  .addBands(SR).addBands(TGI).addBands(VARI).addBands(TDVI).addBands(GLI)
      return feature;
  }
    
  }
  
var S1_index = function(roiArea,year_start,year_end,month_start,month_end,compositeType){
    // set parameters for time stamp and study area
    var startYear = year_start;
    var endYear = year_end; 
    var startMonth = month_start;
    var endMonth = month_end;
    var region = roiArea;
    
    // setting temporal filter
    var criteria = ee.Filter.and(
      ee.Filter.bounds(region), 
      ee.Filter.calendarRange(startMonth,endMonth,'month'),
      ee.Filter.calendarRange(startYear,startYear,'year')
    );
    
    // Import the Sentinel-1 dataset
    var sentinel1 = ee.ImageCollection("COPERNICUS/S1_GRD")
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(criteria)
      .sort('system:time_start')
      .select(['VV','VH']); 
      
    var imgData = ee.Image(0);
    
    if(compositeType === 'median'){
      imgData = sentinel1.median();
    }
    if (compositeType === 'mean'){
      imgData = sentinel1.mean();
    }
    if (compositeType === 'min'){
      imgData = sentinel1.min();
    }
    if (compositeType === 'max'){
      imgData = sentinel1.max();
    }
    
    var composite = glcm(imgData, region).addBands(imgData);
    
    return composite;
    
    // Use the ee.Image.unitScale function to rescale the pixel values of this image to the range [0, 1], and the resulting pixel values are floats.
    // Each pixel is then multiplied by 255 to scale the pixel to [0,255].
    // Use the toByte function to convert the float type to an 8-bit integer type. (Since the image.glcmTexture's input image's image elements need to be of integer type)
    function linearStretch(img, region){
      
      // Calculate the maximum and minimum values of the image
      var minMax = img.reduceRegion({
        reducer: ee.Reducer.minMax(),
        geometry: region.geometry(),
        scale: 10, 
        bestEffort: true
      });
    
      var maxValue = ee.Number(minMax.values().get(0));
      var minValue = ee.Number(minMax.values().get(1));
    
      // rescale the pixel values to the range [0, 1]
      var scaledImage = img.unitScale(minValue, maxValue).multiply(255).toByte();
      return scaledImage;
    }
    
    function glcm(img, region){
      
      var scaledImg_VH = linearStretch(img.select(['VH']), region);
      var scaledImg_VV = linearStretch(img.select(['VV']), region);
      var scaledImg = ee.Image([scaledImg_VH, scaledImg_VV]);
      var S1_glcm = scaledImg.glcmTexture(3);
      var asm_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_asm'));
      var contrast_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_contrast'));
      var corr_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_corr'));
      var varr_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_var'));
      var idm_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_idm'));
      var sent_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_sent'));
      var ent_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_ent'));
      var savg_bn = S1_glcm.bandNames().filter(ee.Filter.stringEndsWith('item','_savg'));
      var S1_glcm_composite = asm_bn.cat(contrast_bn).cat(corr_bn).cat(varr_bn)
                      .cat(idm_bn).cat(sent_bn).cat(ent_bn).cat(savg_bn);
      return S1_glcm.select(S1_glcm_composite);
    }
  }
  
// apply void
var S2 = S2_index(ROI,year_start,year_end,month_start,month_end,S2_BANDS,compositeType,cloudPercent);
var S1 = S1_index(ROI,year_start,year_end,month_start,month_end,compositeType);
var dem = plug.dem(ROI);

var imgfeature = S2.addBands(S1).addBands(dem).toDouble();
print("input bandNames", imgfeature.bandNames());

var inputProperties = imgfeature.bandNames();
var classProperty = 'TS';

// 定义一个函数来修改TS字段的值
var updateTS = function(feature) {
  var ts = feature.get(classProperty);  // 获取TS字段的值
  var newTS = ee.Number(ts).eq(120).multiply(0)   // 如果是120，变为0
              .add(ee.Number(ts).eq(150).multiply(1))  
              .add(ee.Number(ts).eq(200).multiply(2))  
              .add(ee.Number(ts).eq(210).multiply(3))  
              .add(ee.Number(ts).eq(410).multiply(4))  
              .add(ee.Number(ts).eq(420).multiply(5))  
              .add(ee.Number(ts).eq(600).multiply(6))  
  // 返回带有更新后的TS值的feature
  return feature.set('TS', newTS);
};

// 应用更新函数到整个FeatureCollection
var sample = sample.map(updateTS);

// 检查更新后的数据
print(sample.first());

var featureCol = imgfeature.sampleRegions({
                  collection:sample,
                  geometries:true,
                  scale:10,
                  tileScale:16
});

print(featureCol.limit(10));

var sample = featureCol.randomColumn();
var trainingSample = sample.filter('random <= 0.7');
var validationSample = sample.filter('random > 0.7');

var trained_RF_Classifier = ee.Classifier.smileRandomForest(200).train({
  features: trainingSample,
  classProperty: classProperty,
  inputProperties: inputProperties
});

var trainAccuracy = trained_RF_Classifier.confusionMatrix();
print('trainAccuracy:', trainAccuracy);
print('trainAccuracy.accuracy():', trainAccuracy.accuracy());
print('trainAccuracy.kappa():', trainAccuracy.kappa());

var validationSample = validationSample.classify(trained_RF_Classifier);
var validationAccuracy = validationSample.errorMatrix(classProperty, 'classification');
print('validationAccuracy:', validationAccuracy);
print('validationAccuracy.accuracy():', validationAccuracy.accuracy());
print('validationAccuracy.kappa():', validationAccuracy.kappa());

var imgClassified = imgfeature.classify(trained_RF_Classifier).updateMask(forest);//.unmask(-999);
Map.addLayer(imgClassified.randomVisualizer(),{},'imgClassified');

Export.image.toDrive({
  image:imgClassified.unmask(-1),
  // crs:imgClassified_mask.projection().crs(),
  region:ROI,
  scale:10,
  maxPixels :1e13,
})
