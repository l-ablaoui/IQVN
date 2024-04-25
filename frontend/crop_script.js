
//Get the drawing context
var canvas = document.getElementById("myExample");
var ctx = canvas.getContext("2d");
var canvas1 = document.getElementById("myOutput");
var ctx1 = canvas1.getContext("2d");


const image = new Image();
image.onload = draw; // Draw when image has loaded
image.src = "flower.png";


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
  ctx1.fillRect(0, 0, canvas1.width, canvas1.height);


  //Compute the ration between the canvas and the image, the draw image operate in the image coordinate system but draw in the canvas coordinate system
  var rationX = image.width / canvas.width;
  var rationY = image.height / canvas.height;
  ctx1.drawImage(image, pointTopLeft.x * rationX, pointTopLeft.y * rationY, (pointBottomRight.x - pointTopLeft.x) * rationX, (pointBottomRight.y - pointTopLeft.y) * rationY,
    0, 0, (pointBottomRight.x - pointTopLeft.x), (pointBottomRight.y - pointTopLeft.y));

}

function fillCircle(point, radius) {
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
  ctx.fill();
}

