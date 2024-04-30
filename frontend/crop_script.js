
//Get the drawing context
var canvas = document.getElementById("myExample");
var ctx = canvas.getContext("2d");
var canvas1 = document.getElementById("myOutput");
var ctx1 = canvas1.getContext("2d");


const image = new Image();
image.onload = draw; // Draw when image has loaded
image.src = "sample.png";


canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("mouseup", onPointerUp);
canvas.addEventListener("mousemove", onPointerMove);

state = "idle";
mouseDown = { x: 0, y: 0 };
var pointTopLeft = { x: 125, y: 125 };
var pointBottomRight = { x: 400, y: 400 };
var center = { x: (pointTopLeft.x + pointBottomRight.x) / 2, y: (pointTopLeft.y + pointBottomRight.y) / 2 };

function getEventLocation(e) {
  return {
    x: e.layerX - e.target.offsetLeft,
    y: e.layerY - e.target.offsetTop,
  };
}

function length2(p1, p2) {
  return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

function onPointerDown(e) {
  mouseDown = getEventLocation(e);
  //Get the closest point
  let dP1 = length2(mouseDown, pointTopLeft);
  let dP2 = length2(mouseDown, pointBottomRight);
  let dC = length2(mouseDown, center);

  let dPTopRight = length2(mouseDown, { x: pointBottomRight.x, y: pointTopLeft.y });
  let dPBottomLeft = length2(mouseDown, { x: pointTopLeft.x, y: pointBottomRight.y });

  let list = [dP1, dP2, dC, dPTopRight, dPBottomLeft];
  //sort the list
  let minIndex = list.indexOf(Math.min(...list)); //Usage of the spread operator

  if (minIndex == 0) state = "dP1";
  if (minIndex == 1) state = "dP2";
  if (minIndex == 2) state = "dC";
  if (minIndex == 3) state = "dCTR";
  if (minIndex == 4) state = "dCBL";

}


// mouse move management with the modification of the points location
function onPointerMove(e) {
  var mousePosition = getEventLocation(e);
  var delta = {
    x: mousePosition.x - mouseDown.x,
    y: mousePosition.y - mouseDown.y,
  };
  switch (state) {
    case "dP1":
      pointTopLeft = { x: pointTopLeft.x + delta.x, y: pointTopLeft.y + delta.y };
      break;
    case "dP2":
      pointBottomRight = { x: pointBottomRight.x + delta.x, y: pointBottomRight.y + delta.y };
      break;
    case "dC":
      pointTopLeft = { x: pointTopLeft.x + delta.x, y: pointTopLeft.y + delta.y };
      pointBottomRight = { x: pointBottomRight.x + delta.x, y: pointBottomRight.y + delta.y };
      break;

    case "dCTR":
      pointTopLeft = { x: pointTopLeft.x, y: pointTopLeft.y + delta.y };
      pointBottomRight = { x: pointBottomRight.x + delta.x, y: pointBottomRight.y };
      break;

    case "dCBL":
      pointTopLeft = { x: pointTopLeft.x + delta.x, y: pointTopLeft.y };
      pointBottomRight = { x: pointBottomRight.x, y: pointBottomRight.y + delta.y };
      break;
  }
  center = { x: (pointTopLeft.x + pointBottomRight.x) / 2, y: (pointTopLeft.y + pointBottomRight.y) / 2 };
  mouseDown = mousePosition;
  draw();
}

function onPointerUp(e) {
  state = "idle";  // update the state with the mouse up
}


function draw() {
  //Clear the background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  //Draw the image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  //Draw the points for the corners of the square
  ctx.fillStyle = "rgba(100,200,255,1)";
  fillCircle(pointTopLeft, 5);
  fillCircle(pointBottomRight, 5);
  fillCircle({ x: pointBottomRight.x, y: pointTopLeft.y }, 5);
  fillCircle({ x: pointTopLeft.x, y: pointBottomRight.y }, 5);

  //Draw the selection rectangle
  ctx.fillStyle = "rgba(100,200,255,0.3)";
  ctx.fillRect(pointTopLeft.x, pointTopLeft.y, pointBottomRight.x - pointTopLeft.x, pointBottomRight.y - pointTopLeft.y);

  ctx.strokeStyle = "rgba(100,200,255,1)";
  ctx.rect(pointTopLeft.x, pointTopLeft.y, pointBottomRight.x - pointTopLeft.x, pointBottomRight.y - pointTopLeft.y);
  ctx.stroke();


  //Canvas 1
  //Clear the background
  ctx1.fillStyle = "white";
  // ctx1.fillRect(0, 0, canvas1.width, canvas1.height);
  ctx1.fillRect(0, 0, (pointBottomRight.x - pointTopLeft.x), (pointBottomRight.y - pointTopLeft.y));


  //Compute the ration between the canvas and the image, the draw image operate in the image coordinate system but draw in the canvas coordinate system
  var rationX = image.width / canvas.width;
  var rationY = image.height / canvas.height;
  canvas1.width = parseInt(pointBottomRight.x - pointTopLeft.x);
  canvas1.height = parseInt(pointBottomRight.y - pointTopLeft.y);
  ctx1.drawImage(image, pointTopLeft.x * rationX, pointTopLeft.y * rationY, (pointBottomRight.x - pointTopLeft.x) * rationX, (pointBottomRight.y - pointTopLeft.y) * rationY,
    0, 0, (pointBottomRight.x - pointTopLeft.x), (pointBottomRight.y - pointTopLeft.y));
  

}

function fillCircle(point, radius) {
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
  ctx.fill();
}


const searchButton = document.getElementById("searchButton");
    searchButton.addEventListener('click', async () => {

        try {
            let inputValue = document.getElementById("queryInput").value.trim();

            let url = null;
            let data_send = null;

            if( inputValue == '' ) {
              const dataURL = canvas1.toDataURL('image/png');
              const response = await fetch(`${server_url}/upload_png/`, {method: 'POST', body: JSON.stringify({ image_data: dataURL }), headers: {'Content-Type': 'application/json'}});
              const body = await response.json();






              
              console.log(body);

              d3.select("g.axisy")
                  .selectAll(".od_item")
                  .remove();

              scores = body;
              let min_value = d3.min(body['scores'], d => d[1]);
              let max_value = d3.max(body['scores'], d => d[1]);

              console.log(min_value, max_value);

              const new_yScale = d3.scaleLinear()
                  .domain([min_value, max_value]) // Range from 0 to 1
                  .range([height, 0]); // Actual height of the axis

              const new_yAxis = d3.axisLeft(new_yScale)
                  .ticks(5);

              const new_xScale = d3.scaleLinear()
                  .domain([0, body['scores'].length]) // Range from 0 to 100
                  .range([0, width]); // Actual width of the axis


              volatile_xScale = new_xScale;
              
              const new_xAxis = d3.axisBottom(new_xScale)        
                  .ticks(10); // Adjust the number of ticks as needed
                                  
              d3.select("g.axis")
                  .transition()
                  .duration(2000)
                  .call(new_xAxis);

              d3.select("g.axisy")
                  .selectAll(".line")
                  .remove();
              
              d3.select("g.axisy")
                  .append("path")
                  .datum(body['scores'])
                  .transition()
                  .duration(2000)
                  .attr("d", d3.line()
                      .x(function(d) { return new_xScale(d[0]); })
                      .y(function(d) { return new_yScale(d[1]); })
                  ).attr("class", "line");

              d3.select("g.axis")
                  .select('.axisy')   
                  .transition()
                  .duration(2000)     
                  .call(new_yAxis);


              console.log(body);

              let which_query = document.getElementById("query-element");
              which_query.innerHTML = inputValue;

              let image = document.getElementById('imsearch-element');
              image.src = '';
              
              

            } else {
              const response = await fetch(`${server_url}/search?query=${inputValue}`);
              const body = await response.json();
              console.log(body);

              d3.select("g.axisy")
                  .selectAll(".od_item")
                  .remove();

              scores = body;
              let min_value = d3.min(body['scores'], d => d[1]);
              let max_value = d3.max(body['scores'], d => d[1]);

              console.log(min_value, max_value);

              const new_yScale = d3.scaleLinear()
                  .domain([min_value, max_value]) // Range from 0 to 1
                  .range([height, 0]); // Actual height of the axis

              const new_yAxis = d3.axisLeft(new_yScale)
                  .ticks(5);

              const new_xScale = d3.scaleLinear()
                  .domain([0, body['scores'].length]) // Range from 0 to 100
                  .range([0, width]); // Actual width of the axis


              volatile_xScale = new_xScale;
              
              const new_xAxis = d3.axisBottom(new_xScale)        
                  .ticks(10); // Adjust the number of ticks as needed
                                  
              d3.select("g.axis")
                  .transition()
                  .duration(2000)
                  .call(new_xAxis);

              d3.select("g.axisy")
                  .selectAll(".line")
                  .remove();
              
              d3.select("g.axisy")
                  .append("path")
                  .datum(body['scores'])
                  .transition()
                  .duration(2000)
                  .attr("d", d3.line()
                      .x(function(d) { return new_xScale(d[0]); })
                      .y(function(d) { return new_yScale(d[1]); })
                  ).attr("class", "line");

              d3.select("g.axis")
                  .select('.axisy')   
                  .transition()
                  .duration(2000)     
                  .call(new_yAxis);


              console.log(body);

              let which_query = document.getElementById("query-element");
              which_query.innerHTML = inputValue;

              let image = document.getElementById('imsearch-element');
              image.src = '';
            }
            


        } catch (error) {
            console.error('Error loading search results:', error);
        }
    });

