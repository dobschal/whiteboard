console.log("[app] Application started");

const appNode = document.getElementById("app");
const svgLayerNode = document.getElementById("svg-layer");
const downloadButtonNode = document.getElementById("download-button");
const importButtonNode = document.getElementById("import-button");
const dashedSwitchButtonNode = document.getElementById("dashed-switch-button");
let nextElementId = 0;
let activeTextElement;
let activeDrawingElement;
let isDragging = false;
let lastMousePosX = 0;
let lastMousePosY = 0;
let isEditingText = false;
let drawingPoints = [];
let drawingPolygonEl = undefined;
let drawingTimestamp = undefined;
let useDashedLines = false;

const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener("change", e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            console.log("[app] File content: ", content);
            const parsedContent = JSON.parse(content);
            parsedContent.textBoxes?.forEach(textBox => {
                addText(textBox.left, textBox.top, textBox.text, false);
            });
            parsedContent.polylines?.forEach(polyline => {
                addDrawing(polyline.points, polyline.dashed);
            });
        }
    });
    input.click();
};

const download = (filename, text) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
};

const addText = (x, y, text = "", focus = true) => {
    let elementId = nextElementId;
    nextElementId++;
    appNode.insertAdjacentHTML("beforeend", `
        <div id="el-${elementId}" class="text-box" contenteditable="true" style="left: ${x}; top: ${y}">${text}</div>
    `);
    let element = document.getElementById("el-" + elementId);
    element.addEventListener("mousedown", (e) => {
        e.preventDefault();
        console.log("[app] Mouse down on text: ", e);
        isDragging = true;
        activeTextElement = element;
        lastMousePosX = e.clientX;
        lastMousePosY = e.clientY;
    });
    if (focus) {
        setTimeout(() => {
            element.focus();
        });
    }
    element.addEventListener("click", (e) => {
        e.stopPropagation();
        isEditingText = true;
        element.focus();
    });
    element.addEventListener("blur", () => {
        isEditingText = false;
    });
}

const addDrawing = (points, userDashlines_) => {
    let elementId = nextElementId;
    nextElementId++;
    drawingPoints.push([Math.round(lastMousePosX), Math.round(lastMousePosY)]);
    svgLayerNode.insertAdjacentHTML("beforeend", `
            <polyline id="el-${elementId}" 
                      points="${points}"
                      ${useDashedLines || userDashlines_ ? "class=\"dashed\"" : ""} 
                      stroke-linejoin="round" 
                      stroke-linecap="round" />
        `);
    drawingPolygonEl = document.getElementById("el-" + elementId);
    console.log("[app] Added drawing el: ", drawingPolygonEl);
    drawingPolygonEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        console.log("[app] Mouse down on drawing: ", e, drawingPolygonEl);
        isDragging = true;
        activeDrawingElement = document.getElementById("el-" + elementId);
        lastMousePosX = e.clientX;
        lastMousePosY = e.clientY;
    });
}

const moveDrawing = (e) => {
    const diffY = lastMousePosY - e.clientY;
    const diffX = lastMousePosX - e.clientX;
    const points = activeDrawingElement
        .getAttribute("points")
        .split(" ")
        .map(pointAsString => {
            return pointAsString
                .split(",")
                .map((v, i) => {
                    if (i === 0) return Number(v - diffX);
                    return Number(v - diffY);
                });
        });
    const pointsAsString = points.map(point => point.join(",")).join(" ");
    activeDrawingElement.setAttribute("points", pointsAsString);
}

const continueDrawing = (e) => {
    const diffY = drawingPoints[drawingPoints.length - 1][1] - e.clientY;
    const diffX = drawingPoints[drawingPoints.length - 1][0] - e.clientX;
    if ((Math.abs(diffY) > 5 || Math.abs(diffX) > 5) &&
        (!drawingTimestamp || Date.now() - drawingTimestamp > 25)) {
        drawingPoints.push([
            Math.round(lastMousePosX),
            Math.round(lastMousePosY)
        ]);
        drawingPolygonEl
            .setAttribute(
                "points",
                drawingPoints.map(dp => dp.join(",")).join(" ")
            );
        drawingTimestamp = Date.now();
    }
}

document.addEventListener("mousedown", (e) => {
    console.log("[app] Global mousedown: ", e);
    isDragging = true;
    lastMousePosX = e.clientX;
    lastMousePosY = e.clientY;
    if (!activeTextElement && !activeDrawingElement) {
        addDrawing(lastMousePosX + "," + lastMousePosY);
    }
});

document.addEventListener("mouseup", () => {
    console.log("[app] Mouse up...");
    isDragging = false;
    activeTextElement = undefined;
    activeDrawingElement = undefined;
    drawingPolygonEl = undefined;
    drawingPoints = [];
});

document.addEventListener("mousemove", (e) => {
    if (isDragging && activeDrawingElement && !isEditingText) {
        moveDrawing(e);
    } else if (isDragging && activeTextElement && !isEditingText) {
        const diffY = lastMousePosY - e.clientY;
        const diffX = lastMousePosX - e.clientX;
        activeTextElement.style.top = (activeTextElement.offsetTop - diffY) + "px";
        activeTextElement.style.left = (activeTextElement.offsetLeft - diffX) + "px";
    } else if (isDragging && !isEditingText && drawingPolygonEl) {
        continueDrawing(e);
    }
    lastMousePosX = e.clientX;
    lastMousePosY = e.clientY;
});

document.addEventListener('dblclick', (e) => {
    if (isEditingText) return;
    addText(e.clientX + "px", e.clientY + "px", "");
});

downloadButtonNode.addEventListener("click", () => {
    const textBoxes = [];
    const polylines = [];
    document.querySelectorAll("#app > div.text-box").forEach(node => {
        const {top, left} = node.style;
        const text = node.innerText;
        textBoxes.push({top, left, text});
    });
    document.querySelectorAll("#svg-layer > polyline").forEach(node => {
        const points = node.getAttribute("points");
        const className = node.getAttribute("class");
        let dashed = className === "dashed";
        polylines.push({points, dashed});
    });
    download("whiteboard.json", JSON.stringify({textBoxes, polylines}, null, 4))
});

importButtonNode.addEventListener("click", () => {
    importData();
});

dashedSwitchButtonNode.addEventListener("click", () => {
    useDashedLines = !useDashedLines;
    dashedSwitchButtonNode.className = useDashedLines ? "active" : "";
});