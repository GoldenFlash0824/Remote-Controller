const socket = io();

const remoteVideo = document.getElementById('remoteVideo');
// const localVideo = document.getElementById('localVideo'); // Ensure you have this in your HTML to display local stream
const connectButton = document.getElementById('connect');
const remoteIdInput = document.getElementById('remoteId');
const mySocketIdDisplay = document.getElementById('mySocketId');

let localStream = null;
let peerConnection = null;

// Initial setup for local media
navigator.mediaDevices.getDisplayMedia({ video: true })
    .then(stream => {
        localStream = stream;
        // localVideo.srcObject = localStream; // Display local video stream on the page

    })
    .catch(error => {
        console.error('Error accessing media devices.', error);
    });

socket.on('connect', () => {
    console.log('Connected to server, Socket ID:', socket.id);
    mySocketIdDisplay.textContent = socket.id; // Display the socket ID on the page
});

connectButton.onclick = () => {
    const remoteId = remoteIdInput.value;
    createPeerConnection();
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', { offer: peerConnection.localDescription, to: remoteId });
        });
};

socket.on('offer', ({ offer, from }) => {
    createPeerConnection();
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => socket.emit('answer', { answer: peerConnection.localDescription, to: from }));
});

socket.on('answer', ({ answer }) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('candidate', ({ candidate }) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

function createPeerConnection() {
    peerConnection = new RTCPeerConnection();
    // localStream.getTracks().forEach(track => {
    //     peerConnection.addTrack(track, localStream);
    // });
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('candidate', { candidate: event.candidate, to: remoteIdInput.value });
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }
}

