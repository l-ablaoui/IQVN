//Get the drawing context
var video = document.getElementById("video");
var ctx = video.getContext("2d");
var cropped = document.getElementById("crop");
var ctx_cropped = cropped.getContext("2d");

video.addEventListener("mousedown", onPointerDown);
video.addEventListener("mouseup", onPointerUp);
video.addEventListener("mousemove", onPointerMove);

state = "idle";
var pointTopLeft = { x: 10, y: 10 };
var pointBottomRight = { x: Math.max(20, video.width / 4), y: Math.max(20, video.height / 4) };
var center = { x: (pointTopLeft.x + pointBottomRight.x) / 2, y: (pointTopLeft.y + pointBottomRight.y) / 2 };
var mouseDown = center;

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
  // Access the width and height properties
  const width = window.current_frame.width;
  const height = window.current_frame.height;

  // Set video dimensions to match the image
  video.width = width;
  video.height = height;

  // Clear any previous content on the canvas
  ctx.clearRect(0, 0, video.width, video.height);

  // Draw the image onto the video
  ctx.drawImage(window.current_frame, 0, 0, width, height);

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

  /*drawing the lil cropped image on the bottom */
  //Cropped part
  //Clear the background
  ctx_cropped.fillStyle = "white";
  // ctx_cropped.fillRect(0, 0, cropped.width, cropped.height);
  ctx_cropped.fillRect(0, 0, (pointBottomRight.x - pointTopLeft.x), (pointBottomRight.y - pointTopLeft.y));


  //Compute the ratio between the container and the actual image, then draw image operate in the image coordinate system but draw in the video coordinate system
  var rationX = window.current_frame.width / video.width;
  var rationY = window.current_frame.height / video.height;
  cropped.width = parseInt(pointBottomRight.x - pointTopLeft.x);
  cropped.height = parseInt(pointBottomRight.y - pointTopLeft.y);
  ctx_cropped.drawImage(window.current_frame, pointTopLeft.x * rationX, pointTopLeft.y * rationY, (pointBottomRight.x - pointTopLeft.x) * rationX, (pointBottomRight.y - pointTopLeft.y) * rationY,
    0, 0, (pointBottomRight.x - pointTopLeft.x), (pointBottomRight.y - pointTopLeft.y));
}

function fillCircle(point, radius) {
  ctx.beginPath();
  ctx.ellipse(point.x, point.y, radius, radius, 0, 0, 2 * Math.PI);
  ctx.fill();
}
