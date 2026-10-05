/*
Copyright © 2026 🦊 helloyanis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

const browserApi = globalThis.browser ?? globalThis.chrome;
const elements = {
	enabled: document.querySelector("#enabled"),
	disableRealCameras: document.querySelector("#disableRealCameras"),
	cameraType: document.querySelector("#cameraType"),
	cameraName: document.querySelector("#cameraName"),
	videoFeed: document.querySelector("#videoFeed"),
	status: document.querySelector("#status")
};
const defaults = {
	enabled: true,
	disableRealCameras: true,
	cameraType: "front",
	cameraName: "vCam Virtual Camera"
};
let feedStream;
let feedVideo;
let feedCanvas;
let feedContext;
let feedPort;
let feedTimer;
let encodingFrame = false;

const settings = await browserApi.storage.local.get(defaults);
elements.enabled.checked = settings.enabled;
elements.disableRealCameras.checked = settings.disableRealCameras;
elements.cameraType.value = settings.cameraType;
elements.cameraName.value = settings.cameraName;

for (const field of [elements.enabled, elements.disableRealCameras, elements.cameraType, elements.cameraName]) {
	field.addEventListener("change", async () => {
		const values = {
			enabled: elements.enabled.checked,
			disableRealCameras: elements.disableRealCameras.checked,
			cameraType: elements.cameraType.value,
			cameraName: elements.cameraName.value.trim() || defaults.cameraName
		};
		elements.cameraName.value = values.cameraName;
		await browserApi.storage.local.set(values);
	});
}

elements.videoFeed.addEventListener("click", async () => {
	if (feedStream) {
		stopFeed();
		return;
	}
	try {
		feedStream?.getTracks().forEach((track) => track.stop());
		feedStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
		feedVideo = document.createElement("video");
		feedVideo.srcObject = feedStream;
		feedVideo.muted = true;
		await feedVideo.play();
		feedCanvas = document.createElement("canvas");
		feedCanvas.width = feedVideo.videoWidth;
		feedCanvas.height = feedVideo.videoHeight;
		feedContext = feedCanvas.getContext("2d", { alpha: false, desynchronized: true });
		feedPort = browserApi.runtime.connect({ name: "vcam-feed" });
		feedStream.getVideoTracks()[0].addEventListener("ended", stopFeed);
		elements.status.textContent = "Video feed active";
		elements.videoFeed.textContent = "Stop video feed";
		sendFrame();
	} catch (error) {
		elements.status.textContent = error.name === "NotAllowedError" ? "Video feed cancelled" : "Unable to start video feed";
	}
});

function sendFrame() {
	if (!feedStream || feedVideo.readyState < 2 || !feedPort) return;
	if (!encodingFrame) {
		encodingFrame = true;
		feedContext.drawImage(feedVideo, 0, 0, feedCanvas.width, feedCanvas.height);
		feedCanvas.toBlob((blob) => {
			encodingFrame = false;
			if (blob && feedStream && feedPort) {
				feedPort.postMessage({
					type: "frame",
					frame: blob,
					width: feedCanvas.width,
					height: feedCanvas.height
				});
			}
			scheduleFrame();
		}, "image/jpeg", 0.65);
	}
	if (!encodingFrame) scheduleFrame();
}

function scheduleFrame() {
	if (!feedStream) return;
	feedTimer = requestAnimationFrame(sendFrame);
}

function stopFeed() {
	feedStream?.getTracks().forEach((track) => track.stop());
	feedStream = undefined;
	encodingFrame = false;
	cancelAnimationFrame(feedTimer);
	feedTimer = undefined;
	feedPort?.disconnect();
	feedPort = undefined;
	elements.videoFeed.textContent = "Start video feed";
	elements.status.textContent = "Video feed stopped";
}