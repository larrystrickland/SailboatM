// Global Variables 
var ctx;
var slider, timeStart, timeEnd; // slider and selected values for time - reset on file load
var sliderX, xMax, xMin, plotXMax, plotXMin; // sider for selected Max and Min of X - reset on file load or rotation
var sliderY, yMax, yMin, plotYMax, plotYMin; // slider for slecting max and min of Y - reset on file load or rotation
var sliderRot, angle = 0;// Rotation slider, default 0  
var minTime, maxTime, minLat, maxLat, minLon, maxLon, minX, maxX, minY, maxY; // from all datasets loaded
var lineStartX, lineStartY;
var markCounter = 1;
var lineCounter = 1;
// first 6 reset on file load, last four reset on file load or rotation.  
var R = 6378137.0; // radius of earth
var angle = 0; // angle value (from angle slider)
var annimationInterval; // used to remember how long before updating graph in animation
var lastUpdate; // remembers last time graph was updated (so time delta can be calculated for annimation)

var loadedData = []; //Stores all loaded data.

var progressBar = []; // for showing file loading progress

var parseTime = d3.timeParse("%y-%m-%d %H:%M:%S.%L");
var t0 = new Date(2000, 1, 1);
var editLabelDialog, label , labelID ;

var colors = ['#a50026','#d73027','#f46d43','#fdae61','#fee08b','#d9ef8b','#a6d96a','#66bd63','#1a9850','#006837'];
var colorCounter =0;

const plugin = {
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart, args, options) => {
    const {ctx} = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = options.color || '#99ffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

$(document).ready(function () {  
  /**
   * The following section function, will put any <a class="modal"...> into a dialog, that can be moved around
   * Currently used to provide help window.  
   * **/
  
  $('.modal').on('click', function(e){
      e.preventDefault();
      $('<div/>', {'class':'myDlgClass', 'id':'link-'+($(this).index()+1)})
      .load($(this).attr('href')).appendTo('body').dialog().dialog("option","title","Help");
  });
  

  $("#rightcolumn").resizable({handles: 'e'});
  $("#leftcolumn").resizable({handles: 'e'});
  //$("#rightcolumn").draggable();
  $( "#navbar" ).menu({position: {at: "left bottom"}});
 // $("#leftcolumn").draggable();
  
  /** 
   * label, lableID editLabelDialog and form are all used as part of the ability to modify labels on
   * the boats, marks and lines
   * **/
  label = $( "#label" );    labelID = $( "#labelID" );  // label and labelID are use for updating labels  
  editLabelDialog = $( "#dialog-editLabel" ).dialog({ //dialog that collects labels  
    autoOpen: false,
    height: 200,
    width: 350,
    modal: true,
    buttons: {
      "Update Label": updateLabel,
      Cancel: function() {
        editLabelDialog.dialog( "close" );
      }
    },
    close: function() {
      form[ 0 ].reset();
    }
  });
  form = editLabelDialog.find( "form" ).on( "submit", function( event ) {
    event.preventDefault();
    console.log(labelID.val() +" " + label.val())
    updateLabel();
  });

  // Slider at bottom of graph with start and finish times
  slider = $( "#slider" ).slider({
      range: true,
      min: 0,
      max: 500,
      values: [ 75, 300 ],
      slide: function( event, ui ) {
          //console.log( ui.values[ 0 ] + "  " + ui.values[ 1 ] );
          timeStart = ui.values[ 0 ];
          timeEnd = ui.values[ 1 ];
      updateTime();
    },
  });
  
  /**slider.on('slidestop', function () {
              // alert('Slider Stop Event Triggered!');
      updateTime();
  })**/
  // Slider for X max and min - not currently used
  /**sliderX = $( "#sliderX" ).slider({
      range: true,
      min: 0,
      max: 500,
      values: [ 75, 300 ],
      slide: function( event, ui ) {
          // console.log( ui.values[ 0 ] + "  " + ui.values[ 1 ] );
      }
  }); **/
  // Slider for y max and min - not currently used
  /** sliderY = $( "#sliderY" ).slider({
      range: true,
      min: 0,
      max: 500,
      values: [ 75, 300 ],
      slide: function( event, ui ) {
          console.log( ui.values[ 0 ] + "  " + ui.values[ 1 ] );
      }
  }); **/

  // Rotation slider, 0 to 2pi radians
  sliderRot = $( "#sliderRot" ).slider({
      // range: false,
      min: 0,
      max: 2*Math.PI,
      step: 0.01,
      values: 0,
      slide: function( event, ui ) {
          angle = ui.value;
          plotData();
      } 
  });
  
  // Canvas for Plot, includes mousedown functions to add marks, and Lines
  ctx = $('#myChart').on({
    mousedown: function(e) {
      cords = mouseClickCords(e);
      if (cords[0] != '' && cords[1] != '') {// check to see event has x, y coordinates
        if (e.which  == 1) { //left mouse button - so will be adding a mark
          // Build data item to add to data
          item = { label: "Mark "+markCounter, data:  [xy2GPS(cords[0], cords[1])], showLine: false, pointStyle: 'circle', pointRadius: 5, bml:'mark' , hidden: false, borderColor:colors[colorCounter], backgroundColor: colors[colorCounter]};
          colorCounter +=1; colorCounter = (colorCounter > colors.length-1) ? 0 : colorCounter;
          loadedData.push(item);
          markCounter += 1;
          // new data added, so have to replot
          plotData();
          updateObjectList();
        }
        if (e.which == 3) { //left mouse button - so start of line}
          // remember start location
          lineStartX = cords[0];
          lineStartY = cords[1];
        }
      }
    }
    ,
    mouseup: function(e) {
      cords = mouseClickCords(e);
      if (cords[0] != '' && cords[1] != '') {
        if (e.which == 3) { //left mouse button}
          // Mouse up on left mouse, so need to add a line
          // Build line item
          item = { label: "Line "+lineCounter , data:  [xy2GPS(lineStartX, lineStartY), xy2GPS(cords[0], cords[1])], showLine: true, pointStyle: 'rect', pointRadius: 3, bml:'line' , hidden: false, borderColor:colors[colorCounter], backgroundColor: colors[colorCounter]};
          colorCounter +=1; colorCounter = (colorCounter > colors.length-1) ? 0 : colorCounter;
          loadedData.push(item);
          lineCounter += 1;
          plotData();
          updateObjectList();
        }
      }
    }
  });
      
  // Create chart variable
  var myChart = new Chart(ctx, {
      type: 'line',
      data: {}
  });
  
  //$("#confCsv").addEventListener('click', function() {
  /**document.querySelector("#confCsv").addEventListener('click', function() {
    if(document.querySelector("#csv").files.length == 0) {
      alert('Error : No file selected');
    return;
    } **/

    document.querySelector("#csv").addEventListener('change',function () {
    
    var files = document.querySelector("#csv").files; // a collection of files, if the user selects more than one
    Array.from(files).forEach(file => {
        // TBD perform validation on file type & size if required
        var reader = new FileReader();
        progressBar[file.name] = $('<div><div  class="progress-label">Loading:'+file.name+'</div></div>').progressbar({
          value: false,
        });
        reader.addEventListener('loadstart', function() {
          $('#progressbars').append(progressBar[file.name]);
        });

        reader.addEventListener('progress', function(e){
          if (e.lengthComputable) {
            var progress = ((e.loaded / e.total) * 50);
            // console.log(file.name+" "+e.loaded+" "+e.total);
            progressBar[file.name].progressbar('value', progress);
            // console.log(e.loaded+" "+e.total);
          }
        });
    
        reader.addEventListener('load', function(e) { // add listener for when file has finished loading
        // TO BE DONE: Validate csv format is good for this application
          var header = e.target.result.split('\n').shift().replace(/\s/g, '');
          // console.log(header);
          
          if(/Satellites,Latitude,Longitude,Speed,Heading,Date/.test(header)){
            result = $.csv.toObjects(e.target.result); // should contain a collection of rows from file
            console.log(result);
            result.forEach(function(d) { 
              d.Satellites = +d.Satellites;
              d.Latitude = +d.Latitude;
              d.Longitude = +d.Longitude;
              d.Speed = +d.Speed;
              d.Heading = +d.Heading;
              temp = d.Date;
              milliLength = temp.split('.')[1].length;
              if (milliLength == 1) {d.Date+'00';}
              if (milliLength == 2) {d.Date+'0';}
              d.date1 = parseTime(d.Date); 
              d.milliseconds = d.date1-t0;
              d.x = 0; 
              d.y = 0;
              // Update every 100 
            });
            var pr = Array(result.length).fill(1);
            // Build an item which will represent the meta data about the file just loaded, including information about how to plot the data
            item = { label: file.name , data: result, showLine: false,
                    pointStyle: 'circle', pointRadius: pr , bml: 'boat',
                      borderColor: colors[colorCounter], hidden: false};
            colorCounter +=1; colorCounter = (colorCounter > colors.length-1) ? 0 : colorCounter;
            // Store the item int the loadedData collection (note this holds boats, marks and lines - identified by the bml parameter)
            loadedData.push(item);
            // Since new boat data is being loaded, we need to update the various maximums and minimums
            updateMaxMin();
            // Because we have new data, we should replot.  
            plotData();
            updateObjectList();
          } else {
            alert("File format appears to be incorrect");
          }
          setTimeout(removeItem(file.name), 10000);
        });
        reader.readAsText(file);
    });
  });     
 });

 // Used to remove progressBars once done.
 function removeItem(item){
  progressBar[item].remove();
}

/** mouseClickCords converts a click on the chart to the x and y coordidates used by the plot
 *       Input e (the mouseclick event)
 * 		 Output [x,y] in the chart coordinates
 * **/ 
function mouseClickCords(e){
  var myChart = Chart.getChart('myChart');
  var ytop = myChart.chartArea.top;
  var ybottom = myChart.chartArea.bottom;
  var newy = '';
  var showstuff = 0;
  if (e.offsetY <= ybottom && e.offsetY >= ytop) {
    newy = Math.abs((e.offsetY - ytop) / (ybottom - ytop));
    newy = (newy - 1) * -1;
    newy = newy * (Math.abs(plotYMax - plotYMin)) + plotYMin;
    showstuff = 1;
  }
  var xtop = myChart.chartArea.left;
  var xbottom = myChart.chartArea.right;
  var newx = '';
  if (e.offsetX <= xbottom && e.offsetX >= xtop && showstuff == 1) {
    newx = Math.abs((e.offsetX - xtop) / (xbottom - xtop));
    newx = newx * (Math.abs(plotXMax - plotXMin)) + plotXMin;
  }
  return [newx, newy];
}

/** updateMaxMin updates all maximums and minimums
 * **/
function updateMaxMin (){
  minLon = d3.min(loadedData, function(ld){return d3.min(ld.data, function(d){return d.Longitude})});
  maxLon = d3.max(loadedData, function(ld){return d3.max(ld.data, function(d){return d.Longitude})});
  minLat = d3.min(loadedData, function(ld){return d3.min(ld.data, function(d){return d.Latitude})});
  maxLat = d3.max(loadedData, function(ld){return d3.max(ld.data, function(d){return d.Latitude})});
  minTime = d3.min(loadedData, function(ld){return d3.min(ld.data, function(d){return d.milliseconds})});
  maxTime = d3.max(loadedData, function(ld){return d3.max(ld.data, function(d){return d.milliseconds})});
  slider.slider("option", "min", minTime); slider.slider("option", "max", maxTime);
  slider.slider('values',0,minTime); // sets first handle (index 0) to 50
  slider.slider('values',1,maxTime);
}

/** radians converts degrees to radians
 *     Input: the degrees
 *     Output: radians
 * 
 * **/
function radians(degrees) {
  return degrees/180.00*Math.PI;
}

/** radians converts radians to degrees
 *     Input: the radians
 *     Output: degrees
 * 
 * **/
function degrees(radians) {
  return radians*180.00/Math.PI;
}

/** convertMeters: 
 * 1. Creates x, and y coordinates in meters from lat and lon
 * 2. Updates minimums and maximums based on the values of x, and y 
 * 3. Adjusts scales of plot to ensure a 1:1 aspect ratio (not perfect, but close)
 * 
 * **/ 
function convertMeters(){

// 1. Creates x, and y coordinates in meters from lat and lon
    loadedData.forEach(item => {
  // filter if outside range?  	
    item.data.forEach(d => {
      y = radians(d.Latitude - minLat)*R;
      x = radians(d.Longitude - minLon)*R*Math.cos(radians(minLat));
      const [x1,y1] = rotate(x,y, 1)
      d.x = x1;
      d.y = y1;
    });          
    });

// 2. Updates minimums and maximums based on the values of x, and y
    minX = d3.min(loadedData, function(ld){return d3.min(ld.data, function(d){return d.x})});
    maxX = d3.max(loadedData, function(ld){return d3.max(ld.data, function(d){return d.x})});
    minY = d3.min(loadedData, function(ld){return d3.min(ld.data, function(d){return d.y})});
    maxY = d3.max(loadedData, function(ld){return d3.max(ld.data, function(d){return d.y})});
    plotXMax = maxX;
    plotYMax = maxY;
    plotXMin = minX;
    plotYMin = minY;

// 3. Adjusts scales of plot to ensure a 1:1 aspect ratio (not perfect, but close)
    const xLength = plotXMax - plotXMin;
    const yLength = plotYMax - plotYMin;
    if (xLength > yLength) {
        const difference = xLength - yLength;
        plotYMax = plotYMax + difference / 2;
        plotYMin = plotYMin - difference / 2;
    } else {
        const difference = yLength - xLength;
        plotXMax = plotXMax + difference / 2;
        plotXMin = plotXMin - difference / 2;
    }
}

/** xy2GPS: converts x, y coordinates to lat and lon
 *     Input: x, y (in meters)
 * 	   Returns: lon, lat (as array)
 * **/
function xy2GPS(x, y) {
  const [x1,y1] = rotate(x,y, -1);
  lat = minLat + degrees(y1/R);
  lon = minLon + degrees(x1/R/Math.cos(radians(minLat)));
  // console.log (minLat, lat, minLon, lon);
      return {'Longitude':lon,'Latitude':lat}
}

/** rotate: rotates x, y coordinates about 0.0 
 *     Input: x, y (in meters), dir (+1 or -1)
 *     Uses: angle - which comes from the angle slider
 * 	   Returns: lon, lat (as array)
 * **/
  function rotate(x,y,dir){
          x1 = x*Math.cos(angle*dir)-y*Math.sin(angle*dir);
          y1 = x*Math.sin(angle*dir)+y*Math.cos(angle*dir);
          return [x1,y1];
  }

/** plotData - creates the plot 
 * 
 * **/ 
  function plotData(){
      // Build data structures for plotting
      convertMeters(); // update data based on current settings, and convert to meters to allow for acurate dimensional plot
      const cfg = {
        type: 'scatter',
        //showLine: true,
        data: {
            datasets: loadedData,
        },
        options: {
          parsing: { xAxisKey: 'x', yAxisKey: 'y' },
          events: ['click'] ,
          maintainAspectRatio: true,
          aspectRatio: 1, //this is fixed at 1, because I haven't found an easy way to have other aspect ratios. 
          scales: {
              y: {
                  min: plotYMin, 
                  max: plotYMax
              },
              x: {
                  min: plotXMin, 
                  max: plotXMax    
              }
          },
          animation: {
              duration: 0
          }   ,
          plugins: {
            legend: {
              display: false
            },
            customCanvasBackgroundColor: {
              color: 'white',
            }
          }  
        },
        plugins: [plugin],
      };
      var myChart = Chart.getChart('myChart')
      myChart.destroy();
      myChart = new Chart(ctx, cfg);
  };

  /** updateTime: expected to be run as part of a loop, 
 * 	Creates a copy of the loaded data
 *  Deletes all points that are outside the time parameters 
 *  Uses Global values timeStart and timeEnd
 * **/
function updateTime(){
  // myChart = Chart.getChart('myChart'); // find the chart in component with id 'myChart'
  loadedData.forEach(item => {
    if (item.bml == 'boat'){ // need to only filter out boats, not marks and lines
      for (i = item.data.length - 1; i >= 0; --i) {
        if (item.data[i].milliseconds < timeStart || item.data[i].milliseconds  > timeEnd) {
          item.pointRadius[i] = 0; // Remove elements
        } else {
          item.pointRadius[i] = 1; // Add elements back
        }
      }
    }
  });
  Chart.getChart('myChart').update();
};

/** startStopAnnimmdation (sp?): toggles between time annimation or not
 *  Either clears, or starts the annimationInterval
 * 
 * **/
function startStopAnnimdation(){
  if(annimationInterval) { 
    clearInterval(annimationInterval);
    annimationInterval = null;
    lastUpdate = null;
  }
  else {
    annimationInterval = setInterval(annimateTime, 100);
  }
}

/** annimateTime - processes the update to time (as part of a loop) to annimate over time
 * Uses value from timeMultipler Input
 * updates time slider
 * then calls updateTime to actually do the graph update
 * **/
function annimateTime(){
  var delta
  var timeMultiplier = $("#timeMultiplier").val(); 
  // console.log("timeMultiplier = "+timeMultiplier) 
  if (!timeMultiplier){
    timeMultiplier = 20;}

  if (!lastUpdate){
    lastUpdate = Date.now();
    delta = 0;
  } else {
    delta = (Date.now()-lastUpdate) * timeMultiplier;
    lastUpdate = Date.now();
  }
  
  // var myChart = Chart.getChart('myChart');
  timeStart = timeStart + delta;
  timeEnd = timeEnd + delta;
  if (timeEnd > maxTime) {
    timeEnd = maxTime;
    startStopAnnimdation();
  }

  if (timeStart < minTime) {
    timeStart = maxTime;
    startStopAnnimdation();
  }

  slider.slider('values',0,timeStart); // sets first handle (index 0) to 50
  slider.slider('values',1,timeEnd);
  updateTime();
}

/** updateObjectList 
 *  Builds the list of objects, including options to delete, make invisible, etc
 * **/
function updateObjectList(){
  var loadedObjects = $('#loadedObjects')
  // var colors = ['#FF0000', '#00FF00', '#0000FF', '#808080']
  var colorString ='';
  loadedObjects.empty();
  $.each(loadedData, function(i)
  {
    colorString ='';
    colorString += '<option selected="selected" value="'+loadedData[i].borderColor+'" rgb="'+loadedData[i].borderColor+'" style="background-color:'+loadedData[i].borderColor+'"> </option>'
    $.each(colors, function(j){
       colorString += '<option value="'+colors[j]+'" rgb="'+colors[j]+'" style="background-color:'+colors[j]+'"> </option>'
    });
    if(loadedData[i].hidden){
      var vis_icon = '<span class="ui-icon ui-icon-check" onclick="showItem('+i+')"></span><span class="ui-icon ui-icon-blank"></span>'
    } else {
      var vis_icon = '<span class="ui-icon ui-icon-blank"></span><span class="ui-icon ui-icon-close" onclick="hideItem('+i+')"></span>'
    }
    loadedObjects.append(
      '<div>' 
      + vis_icon
      + '<select onchange="updateColor('+i+',this)" style="background-color:'+loadedData[i].borderColor+'">'+ colorString + '</select>'
      + '<span class="ui-icon ui-icon-trash" onclick="deleteItem('+i+')"/>'
      + '<span class="ui-icon ui-icon-pencil" onclick="editLabelPopup('+i+')"/>'
      + loadedData[i].label+'</div>'
    )
  });
}

/**
 * editLabelPopup - brings up the edit label dialog, and sets the values
 * updateLabel - then does the actual label updating, once users has entered the information
 * **/
function editLabelPopup(i){
  console.log(i);
  labelID.val(i);
  label.val(loadedData[i].label);
  editLabelDialog.dialog("open");
}
function updateLabel(){
  console.log (labelID.val() + " " + label.val());
  loadedData[labelID.val()].label = label.val();
  editLabelDialog.dialog("close");
  updateObjectList();
}

/** 
 * deleteItem deletes and item from the list of plottable items
 * **/
function deleteItem(i){
  loadedData.splice(i,1);
  updateObjectList();
  plotData();
  //Chart.getChart('myChart').update();
}

/** 
 * hideItem changes the visibility of an item.
 * **/
function hideItem(i){
  loadedData[i].hidden = true;
  updateObjectList();
  Chart.getChart('myChart').update();
}

/**
 * showItem changes the visitilbity of an item
 * **/
function showItem(i){
  loadedData[i].hidden = false;
  updateObjectList();
  Chart.getChart('myChart').update();
}

/**
 * Update Color, updates the color of the item, based on 
 * **/
function updateColor(i, color){
  console.log("updating color of "+i+" with "+color.value+" from "+loadedData[i].borderColor);
  loadedData[i].borderColor = color.value;
  updateObjectList();
  Chart.getChart('myChart').update();
}

/**
 * downloadJSON converts the various elements loaded into json and allows it to be downloaded.  
 * **/
function downloadJSON() {
   var fileName = 'boats.json', contentType = 'text/plain';
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(loadedData)], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

/** loadJSON and onFileSelected work togehter to load a .json file into the system.  It is one saved from before, it will recreate the situation
 * **/
function loadJSON(){
  var fileDialog = $('<input type="file">');
  fileDialog.click();
  fileDialog.on("change",onFileSelected);
    return false;
};

var onFileSelected = function(e){
  var file = $(this)[0].files[0];
  console.log(file);
  var reader = new FileReader();
  reader.addEventListener('load', function(e) { 
    loadedData = JSON.parse(e.target.result)
    updateMaxMin(); 
    plotData();
    updateObjectList();
  });
  reader.readAsText(file);
};

/** 
 * Screen shot takes a PNG of the current chart and downloads it.  
 * TODO: add white background before downloading.
 * **/
function screenShot(){
  var a = document.createElement('a');
  //a.href = Chart.getChart('myChart').toBase64Image("image/png", 1.0);
  a.href = document.getElementById('myChart').toDataURL('image/png');
  a.download = 'screenshot.png';
  a.click();
}