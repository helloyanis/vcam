/*
Copyright © 2026 🦊 helloyanis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const browserApi = globalThis.browser ?? globalThis.chrome;
const defaults = {
	enabled: true,
	disableRealCameras: true,
	cameraType: "front",
	cameraName: "vCam Virtual Camera"
};
let settings = { ...defaults };
let latestFrame = createPlaceholderFrame();
const ports = new Set();

browserApi.action.onClicked.addListener(() => {
    if(navigator.userAgent.includes("Mobile;")){
        browserApi.tabs.create({ url: browserApi.runtime.getURL("popup/index.html") });
    }
	else{
        browserApi.windows.create({
            url: browserApi.runtime.getURL("popup/index.html"),
            type: "popup",
            width: 400,
            height: 600
        });
    }
});

browserApi.storage.local.get(defaults).then((stored) => {
	settings = { ...defaults, ...stored };
	broadcast({ type: "config", settings });
});

browserApi.storage.onChanged.addListener((changes) => {
	for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
	broadcast({ type: "config", settings });
});

browserApi.runtime.onConnect.addListener((port) => {
	ports.add(port);
	port.onMessage.addListener((message) => {
		if (message.type === "frame") {
			latestFrame = message.frame;
			broadcast({ type: "frame", frame: latestFrame });
		} else if (message.type === "page-ready" || message.type === "request-frame") {
			port.postMessage({ type: "config", settings });
				port.postMessage({ type: "frame", frame: latestFrame });
		}
	});
	port.onDisconnect.addListener(() => ports.delete(port));
});

function broadcast(message) {
	for (const port of ports) {
		try { port.postMessage(message); } catch { ports.delete(port); }
	}
}

function createPlaceholderFrame() {
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#202124"/><text x="640" y="360" fill="white" font-family="sans-serif" font-size="42" text-anchor="middle">vCam not configured, please open the extension</text></svg>';
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}