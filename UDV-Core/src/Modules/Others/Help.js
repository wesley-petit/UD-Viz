import './Help.css';

/**
* adds a "Help" window that can be open/closed with a button
* simply include this file in the html, no need to instanciate anything in main.js
*/

export function HelpWindow( options={} ) {

  ///////////// Html elements
  var helpDiv = document.createElement("div");
  helpDiv.id = 'helpWindow';
  $("#contentSection").append(helpDiv);

  document.getElementById("helpWindow").innerHTML =
    '<div id="text">\
       <br>\
       <p><a target="_blank"\
       href="https://github.com/iTowns/itowns/blob/master/src/Renderer/ThreeExtended/PlanarControls.js">Camera key bindings</a>:</p>\
       <ul>\
         <li>Left-Click: camera translation (drag)</li>\
         <li>Right-Click: camera translation (pan)</li>\
         <li>Ctrl + Left-Click: camera rotation (orbit)</li>\
         <li>Spacebar / Wheel-Click: smart zoom</li>\
         <li>Mouse Wheel: zoom in/out</li>\
         <li>T: orient camera to a top view</li>\
         <li>Y: move camera to start position</li>\
       </ul>\
       <button id="helpCloseButton">Close</button>\
    </div>\
    ';

    // Close the window...when close button is hit
    document.getElementById("helpCloseButton").addEventListener(
        'mousedown', () => {
            let activate = document.getElementById('activateHelp');
            activate.checked = !activate.checked;
        }, false);
}
