/*
Copyright © 2026 🦊 helloyanis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const browserApi = globalThis.browser ?? globalThis.chrome;
const elements = {
	enabled: document.querySelector("#enabled"),
	cameraType: document.querySelector("#cameraType"),
	cameraName: document.querySelector("#cameraName"),
	videoFeed: document.querySelector("#videoFeed"),
	status: document.querySelector("#status")
};
const defaults = { enabled: true, cameraType: "front", cameraName: "vCam Virtual Camera" };
let feedStream;
let feedVideo;
let feedCanvas;
let feedContext;
let feedPort;

const settings = await browserApi.storage.local.get(defaults);
elements.enabled.checked = settings.enabled;
elements.cameraType.value = settings.cameraType;
elements.cameraName.value = settings.cameraName;

for (const field of [elements.enabled, elements.cameraType, elements.cameraName]) {
	field.addEventListener("change", async () => {
		const values = {
			enabled: elements.enabled.checked,
			cameraType: elements.cameraType.value,
			cameraName: elements.cameraName.value.trim() || defaults.cameraName
		};
		elements.cameraName.value = values.cameraName;
		await browserApi.storage.local.set(values);
	});
}

elements.videoFeed.addEventListener("click", async () => {
		feedStream?.getTracks().forEach((track) => track.stop());
		feedStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
		feedVideo = document.createElement("video");
		feedVideo.srcObject = feedStream;
		feedVideo.muted = true;
		await feedVideo.play();
		feedCanvas = document.createElement("canvas");
		feedCanvas.width = 1280;
		feedCanvas.height = 720;
		feedContext = feedCanvas.getContext("2d");
		feedPort = browserApi.runtime.connect({ name: "vcam-feed" });
		feedStream.getVideoTracks()[0].addEventListener("ended", stopFeed);
		elements.status.textContent = "Video feed active";
		sendFrame();
});

function sendFrame() {
	if (!feedStream || feedVideo.readyState < 2) return;
	feedContext.drawImage(feedVideo, 0, 0, feedCanvas.width, feedCanvas.height);
	feedPort?.postMessage({ type: "frame", dataUrl: feedCanvas.toDataURL("image/jpeg", 0.75) });
	requestAnimationFrame(sendFrame);
}

function stopFeed() {
	feedStream?.getTracks().forEach((track) => track.stop());
	feedStream = undefined;
	feedPort?.disconnect();
	feedPort = undefined;
	elements.status.textContent = "Video feed stopped";
}