const pageState = {
    enabled: true,
    disableRealCameras: true,
    cameraType: "front",
    cameraName: "vCam Virtual Camera"
};
const bridgeToken = crypto.randomUUID();
let latestFrame;
let virtualCanvas;
let virtualContext;
let virtualStream;
let frameImage;
let pendingFrame;
let pendingFrameSize;

window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.type !== "vcam-message" || event.data.token !== bridgeToken) return;
    const message = event.data.message;
    if (message.type === "config") {
        Object.assign(pageState, message.settings);
        if (!pageState.enabled) stopVirtualStream();
    }
    if (message.type === "frame") {
        pendingFrame = message.frame;
        pendingFrameSize = { width: message.width, height: message.height };
        drawFrame();
    }
});

window.postMessage({ type: "vcam-request", token: bridgeToken, action: "ready" }, "*");

const mediaDevices = navigator.mediaDevices;
if (mediaDevices) {
    const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
    const originalEnumerateDevices = mediaDevices.enumerateDevices.bind(mediaDevices);

    mediaDevices.getUserMedia = async (constraints) => {
        if (!pageState.enabled || !constraints?.video) return originalGetUserMedia(constraints);
        if (!shouldUseVirtualCamera(constraints.video)) {
            return originalGetUserMedia(constraints);
        }
        const stream = getVirtualStream(constraints.video);
        if (!constraints.audio) return stream;
        const audioStream = await originalGetUserMedia({ audio: constraints.audio, video: false });
        return new MediaStream([...stream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    };

    mediaDevices.enumerateDevices = async () => {
        const devices = await originalEnumerateDevices();
        if (!pageState.enabled) return devices;
        const visibleDevices = pageState.disableRealCameras
            ? devices.filter((device) => device.kind !== "videoinput")
            : devices;
        return [...visibleDevices, {
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
        virtualContext = virtualCanvas.getContext("2d", { alpha: false, desynchronized: true });
        virtualStream = virtualCanvas.captureStream(60);
        window.postMessage({ type: "vcam-request", token: bridgeToken, action: "request-frame" }, "*");
    }
    const width = videoConstraints?.width?.ideal ?? videoConstraints?.width ?? virtualCanvas.width;
    const height = videoConstraints?.height?.ideal ?? videoConstraints?.height ?? virtualCanvas.height;
    for (const track of virtualStream.getVideoTracks()) {
        try { track.applyConstraints({ width, height }); } catch { /* Use canvas dimensions. */ }
    }
    drawFrame();
    return virtualStream.clone();
}

function shouldUseVirtualCamera(videoConstraints) {
    const deviceId = videoConstraints?.deviceId;
    const requestedId = typeof deviceId === "string" ? deviceId : deviceId?.exact ?? deviceId?.ideal;
    if (requestedId) return requestedId === "vcam-virtual-camera";
    return pageState.disableRealCameras;
}

function drawFrame() {
    if (!virtualContext || !pendingFrame || frameImage) return;
    const frame = pendingFrame;
    const frameSize = pendingFrameSize;
    pendingFrame = undefined;
    pendingFrameSize = undefined;
    if (frameSize?.width && frameSize?.height &&
        (virtualCanvas.width !== frameSize.width || virtualCanvas.height !== frameSize.height)) {
        virtualCanvas.width = frameSize.width;
        virtualCanvas.height = frameSize.height;
    }
    if (typeof frame === "string") {
        frameImage = new Image();
        frameImage.onload = () => {
            virtualContext.drawImage(frameImage, 0, 0, virtualCanvas.width, virtualCanvas.height);
            frameImage = undefined;
            drawFrame();
        };
        frameImage.src = frame;
        return;
    }
    createImageBitmap(frame).then((bitmap) => {
        virtualContext.drawImage(bitmap, 0, 0, virtualCanvas.width, virtualCanvas.height);
        bitmap.close();
    }).finally(() => drawFrame());
}

function stopVirtualStream() {
    virtualStream?.getTracks().forEach((track) => track.stop());
    virtualStream = undefined;
    virtualCanvas = undefined;
    virtualContext = undefined;
}