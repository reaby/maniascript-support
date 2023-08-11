/* eslint-disable valid-typeof */
/* eslint-disable no-undef */
let index = 9999;
let version = 3;
let framemodels = {};
let styleid = {};
let styleclass = {};
let colorclasses = {};

window.onerror = function (msg, url, line) {
    let elem = document.querySelector("#manialink");
    elem.innerHTML = `<div style="min-height: 2rem; min-width: 50%; background: red; color:white;">${msg}</div>`;
};

function readfile() {
    const file = document.getElementById('file').files[0];
    if (file) {
        processFile(file);
    }
}

const processFile = (file) => {
    // we define fr as a new instance of FileReader
    const fr = new FileReader();

    fr.readAsText(file);
    // Handle progress, success, and errors
    // fr.onprogress = updateProgress;
    fr.onloadend = () => {
        renderManialink(fr.result);
    };
};

function renderManialink(contents) {
    try {
        let doc = new DOMParser().parseFromString(contents, "text/xml");
        let html = document.createElement("div");
        let elem = document.querySelector("#manialink");
        let rootNode = doc.evaluate('//manialink', doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        version = rootNode.getAttribute("version") || 3;
        index = 9999;
        framemodels = {};
        styleid = {};
        styleclass = {};
        colorclasses = {};

        walk(rootNode, html);
        elem.innerHTML = "";
        elem.appendChild(html);
        let elems = document.querySelectorAll("span");
        for (let elem of elems) {
            elem.innerHTML = MPStyle.Parser.toHTML(elem.innerText);
        }
    } catch (e) {
        const errorDiv = document.createElement("div");
        errorDiv.setAttribute("style", "min-height: 2rem; min-width: 50%; color:white; background: red; ");
        errorDiv.innerHTML = "Error:" + e;
        html.appendChild(errorDiv);
    }

}

function uuid() {
    return 'Uxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function walk(rootNode, html) {
    let filter = ['lentgh', 'item', 'toString'];
    for (let i in rootNode.childNodes) {
        if (filter.indexOf(i) !== -1) continue;
        let node = rootNode.childNodes[i];
        if (node == null || typeof node === "text") continue;
        try {
            switch (node.nodeName) {
                case "quad": {
                    html.appendChild(genImage(node));
                    break;
                }
                case "label": {
                    let prefix = "";
                    if (getAttribute("textprefix", node)) {
                        prefix = getAttribute("textprefix", node);
                    }
                    let text = getAttribute("text", node);
                    if (!text) {
                        text = "&nbsp;";
                    } else {
                        text = text.replace("&", "&amp;");
                    }
                    let outHtml = document.createElement("span");
                    outHtml.innerText = prefix + text;
                    outHtml.setAttribute("style", genStyle(node));
                    outHtml.setAttribute("id", getAttribute("id", node));
                    const fhcolor = getAttribute("focusareacolor2", node);
                    if (fhcolor && getAttribute("scriptevents", node) == "1") {
                        if (colorclasses[fhcolor]) {
                            outHtml.classList.add(colorclasses[fhcolor]);
                        } else {
                            const uid = uuid();
                            colorclasses[fhcolor] = uid;
                            outHtml.classList.add(uid);
                            document.head.insertAdjacentHTML('beforeend', `<style> span.${uid}:hover{ background-color: #${fhcolor} !important; }</style>`);
                        }
                    }
                    html.appendChild(outHtml);
                    break;
                }
                case "entry": {
                    let outHtml = document.createElement("input");
                    outHtml.setAttribute("style", "color: white;" + genStyle(node) + "border: none;");
                    outHtml.setAttribute("id", getAttribute("id", node));
                    outHtml.setAttribute("value", getAttribute("default", node));
                    html.appendChild(outHtml);
                    break;
                }
                case "textedit": {
                    let outHtml = document.createElement("textarea");
                    outHtml.setAttribute("style", "color: white;" + genStyle(node) + "border: none;");
                    outHtml.setAttribute("id", getAttribute("id", node));
                    outHtml.innerHTML = getAttribute("default", node);
                    html.appendChild(outHtml);
                    break;
                }
                case "frame": {
                    let outHtml = document.createElement("div");
                    outHtml.setAttribute("style", genStyle(node));
                    outHtml.setAttribute("id", getAttribute("id", node));
                    frameNode = walk(node, outHtml, false);
                    html.insertBefore(frameNode, html.lastNode);
                    break;
                }
                case "framemodel": {
                    let name = getAttribute("id", node);
                    framemodels[name] = node;
                    break;
                }
                case "stylesheet": {
                    walk(node, html, false);
                    break;
                }
                case "style": {
                    let id = node.getAttribute("id");
                    let cls = node.getAttribute("class");
                    if (id) styleid[id] = node;
                    if (cls) styleclass[cls] = node;
                    break;
                }

                case "frameinstance": {
                    let modelNode = framemodels[getAttribute("modelid", node)] || {};
                    let outHtml = document.createElement("div");
                    outHtml.setAttribute("style", genStyle(node, false));
                    outHtml.setAttribute("id", getAttribute("id", modelNode));
                    frameNode = walk(modelNode, outHtml, false);
                    html.insertBefore(frameNode, html.lastNode);
                    break;
                }
            }
        } catch (err) {
            // console.error(err); silent exception
        }
    }

    return html;
}

function getAttribute(name, node) {
    if (node != null) {
        let id = node.getAttribute("id", node)?.trim().split(" ")[0];
        let cls = node.getAttribute("class", node)?.trim().split(" ")[0];
        let override = "";

        if (id && styleid[id]) {
            override = styleid[id].getAttribute(name);
        }

        if (cls && styleclass[cls]) {
            override = styleclass[cls].getAttribute(name);
        }

        return node.getAttribute(name) || override;
    }
    return {};
}


function genStyle(node) {
    let ssize = getAttribute("size", node);
    let size = (ssize || "0 0").split(/\s+/);
    let sx = parseFloat(size[0]) * (100 / 320);
    let sy = parseFloat(size[1]) * (100 / 320);
    let pos = (getAttribute("pos", node) || "0 0").split(/\s+/);
    let i = 0;
    let j = 0;
    isRoot = node.parentNode?.nodeName == "manialink" ? true : false;

    if (isRoot) {
        i = 160;
        j = 90;

    }

    let px = (parseFloat(pos[0]) + i) * (100 / 320);
    let py = (j - parseFloat(pos[1])) * (100 / 320);

    let valign = getAttribute("valign", node);
    let halign = getAttribute("halign", node);
    let rotox = "0%";
    let rotoy = "0%";
    let out = "";

    switch (valign) {
        case "center":
        case "center2":
            py -= (sy / 2);
            rotoy = "50%";
            out = `display: flex; align-items: center;`;
            break;
        case "bottom":
            py -= sy;
            rotoy = "100%";
            out = `display: flex; align-items: flex-end;`;
            break;
        case "top":
        default:
            out = `display: flex; align-items: start;`;
            break;
    }

    switch (halign) {
        case "center":
        case "center2":
            px -= (sx / 2);
            rotox = "50%";
            out += "display: flex; justify-content: center;";
            break;
        case "right":
            rotox = "100%";
            px -= sx;
            out += "display: flex; justify-content: flex-end;";
            break;
        case "left":
        default:
            out += "display: flex; justify-content: start;";
            break;
    }


    out += `left: ${px}vw; top: ${py}vw;`;
    if (ssize) {
        if (sx > 0) {
            out += `width: ${sx}vw;`;
        } else {
            out += `width: max-content`;
        }
        if (sy > 0) {
            out += `height: ${sy}vw;`;
        } else {
            out += `height: max-content;`;
        }
        out += "overflow: hidden;";
    } else {
        out += `height: inherit;width: inherit;`;
    }

    let textsize = getAttribute("textsize", node);
    if (textsize) {
        let sl = 0.4;
        if (textsize < 2) {
            sl = 0.7;
        }
        out += `font-size: ${textsize * sl}vw;`;
    } else {
        out += `font-size: ${1.5 * 0.5}vw;`;
    }

    let bgcolor = getAttribute("bgcolor", node);
    if (bgcolor && !(getAttribute("image", node))) {
        out += `background-color: #${bgcolor};`;
    }

    let opacity = getAttribute("opacity", node);
    if (opacity) {
        out += `opacity: ${opacity};`;
    }

    let color = getAttribute("textcolor", node) || "$fff";
    if (color && node.nodeName == "label") {
        color = color.replace("$", "");
        out += `color: #${color};`;
    }

    let fcolor = getAttribute("focusareacolor1", node);
    if (fcolor && getAttribute("scriptevents", node) == "1") {
        out += `background-color: #${fcolor};`;
    }

    let font = getAttribute("textfont", node);
    if (font) {
        switch (font) {
            case "Oswald":
            case "OswaldMono":
                out += "font-family: 'Oswald', 'KenneyIcons', 'FontAwesome';";
                break;
            case "Gotham/Gotham-Medium":
                out += "font-weight: 500;";
                break;
            case "Gotham/Gotham-Book":
                out += "font-weight: 400;";
                break;
            case "Gotham/Gotham-Bold":
                out += "font-weight: 700;";
                break;
            case "file://Media/Font/BiryaniDemiBold.Font.gbx":
            case "BiryaniDemiBold":
                out += "font-family: 'Biryani', 'KenneyIcons', 'FontAwesome'; font-weight: 600;";
                break;
            case "Rajdhani":
            case "RajdhaniMono":
                out += "font-family: 'Rajdhani', 'KenneyIcons', 'FontAwesome'; font-weight: 700;";
                break;
        }
    }

    let rot = "";
    let scale = "";
    if (getAttribute("rot", node)) {
        rot = ` translate(${rotox}, ${rotoy}) rotate(${getAttribute("rot", node)}deg) `;
    }
    if (getAttribute("scale", node)) {
        scale = ` scale(${getAttribute("scale", node)}) `;
    }

    if (rot || scale) {
        out += `transform-origin: center; transform: ` + rot + scale + ";";
    }
    let hidden = getAttribute("hidden", node);
    if (hidden && hidden === "1") {
        out += "display: none;";
    }
    const z = getAttribute("z-index", node) || 0;

    if (version == 3) {
        out += "position: absolute; z-index: " + (index - z) + ";";
        index -= 1;
    } else {
        out += "position: absolute; z-index: " + (index + z) + ";";
        index += 1;
    }

    return out;
}

function genImage(node) {
    let outNode = document.createElement("img");
    let src = getAttribute("image", node);

    if (src) {
        src = src.replace("file://", "./");
        outNode.setAttribute("src", src);
    } else {
        outNode = document.createElement("div");
    }
    outNode.setAttribute("style", genStyle(node));
    outNode.setAttribute("id", getAttribute("id", node));
    return outNode;
}
