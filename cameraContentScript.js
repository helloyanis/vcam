/*
Copyright © 2026 🦊 helloyanis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const browserApi = globalThis.browser ?? globalThis.chrome;
let backgroundPort;
let bridgeToken;

function connectToBackground() {
	if (backgroundPort) return backgroundPort;
	backgroundPort = browserApi.runtime.connect({ name: "vcam-page" });
	backgroundPort.onMessage.addListener((message) => {
		if (message.type === "frame" || message.type === "config") {
			window.postMessage({ type: "vcam-message", token: bridgeToken, message }, "*");
		}
	});
	backgroundPort.onDisconnect.addListener(() => { backgroundPort = undefined; });
	return backgroundPort;
}

window.addEventListener("message", (event) => {
	if (event.source !== window || event.data?.type !== "vcam-request") return;
	bridgeToken = event.data.token;
	const port = connectToBackground();
	if (event.data.action === "ready") port.postMessage({ type: "page-ready" });
	if (event.data.action === "request-frame") port.postMessage({ type: "request-frame" });
});