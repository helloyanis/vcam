const pageState = { enabled: true, cameraType: "front", cameraName: "vCam Virtual Camera" };
let latestFrame;
let virtualCanvas;
let virtualContext;
let virtualStream;
let frameImage;

window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "vcam-extension") return;
    if (event.data.type === "config") {
        Object.assign(pageState, event.data.settings);
        if (!pageState.enabled) stopVirtualStream();
    }
    if (event.data.type === "frame") {
        latestFrame = event.data.dataUrl;
        drawFrame();
    }
});

window.postMessage({ source: "vcam-page", type: "ready" }, "*");

const mediaDevices = navigator.mediaDevices;
if (mediaDevices) {
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    const originalEnumerateDevices = mediaDevices.enumerateDevices.bind(mediaDevices);

    mediaDevices.getUserMedia = async (constraints) => {
        if (!pageState.enabled || !constraints?.video) return originalGetUserMedia(constraints);
        const stream = getVirtualStream(constraints.video);
        if (!constraints.audio) return stream;
        const audioStream = await originalGetUserMedia({ audio: constraints.audio, video: false });
        return new MediaStream([...stream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    };

    mediaDevices.enumerateDevices = async () => {
        const devices = await originalEnumerateDevices();
        if (!pageState.enabled) return devices;
        return [...devices, {
            deviceId: "vcam-virtual-camera",
            groupId: "vcam",
            kind: "videoinput",
            label: pageState.cameraName,
            toJSON() { return this; }
        }];
    };
}

function getVirtualStream(videoConstraints) {
    if (!virtualCanvas) {
        virtualCanvas = document.createElement("canvas");
        virtualCanvas.width = 1280;
        virtualCanvas.height = 720;
        virtualContext = virtualCanvas.getContext("2d");
        virtualStream = virtualCanvas.captureStream(30);
        window.postMessage({ source: "vcam-page", type: "request-frame" }, "*");
    }
    const width = videoConstraints?.width?.ideal ?? videoConstraints?.width ?? 1280;
    const height = videoConstraints?.height?.ideal ?? videoConstraints?.height ?? 720;
    for (const track of virtualStream.getVideoTracks()) {
        try { track.applyConstraints({ width, height }); } catch { /* Use canvas dimensions. */ }
    }
    drawFrame();
    return virtualStream.clone();
}

function drawFrame() {
    if (!virtualContext || !latestFrame) return;
    if (!frameImage) frameImage = new Image();
    frameImage.onload = () => virtualContext.drawImage(frameImage, 0, 0, virtualCanvas.width, virtualCanvas.height);
    frameImage.src = latestFrame;
}

function stopVirtualStream() {
    virtualStream?.getTracks().forEach((track) => track.stop());
    virtualStream = undefined;
    virtualCanvas = undefined;
    virtualContext = undefined;
}