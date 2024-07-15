// Firebase Configuration
var firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Request Notification Permission
messaging.requestPermission().then(() => {
  console.log('Notification permission granted.');
  return messaging.getToken();
}).then(token => {
  console.log('FCM Token:', token);
  // Send the token to your server to subscribe the user to notifications
}).catch(err => {
  console.error('Unable to get permission to notify.', err);
});

// Initialize and Add the Map
let map;
let userMarker;
let circles = [];
let isInsideGeofence = false;
let searchBox;
let searchMarker;
let dwellTimeout;
let currentGeofence = null;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -34.397, lng: 150.644 },
    zoom: 8
  });

  const drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.CIRCLE,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: ['circle']
    },
    circleOptions: {
      fillColor: '#FF0000',
      fillOpacity: 0.35,
      strokeWeight: 2,
      clickable: false,
      editable: true,
      zIndex: 1
    }
  });

  drawingManager.setMap(map);

  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
    circles.push(event.overlay);
  });

  document.getElementById('remove-circle').addEventListener('click', () => {
    if (circles.length > 0) {
      const circle = circles.pop();
      circle.setMap(null);
    }
  });

  // Create the user marker as draggable
  userMarker = new google.maps.Marker({
    position: { lat: -34.397, lng: 150.644 },
    map: map,
    draggable: true,
    title: 'Move me!',
    icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' // Custom marker icon (optional)
  });

  google.maps.event.addListener(userMarker, 'dragend', function() {
    checkGeofences(userMarker.getPosition());
  });

  // Search Box
  const input = document.getElementById('pac-input');
  searchBox = new google.maps.places.SearchBox(input);

  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  searchBox.addListener('places_changed', function() {
    const places = searchBox.getPlaces();

    if (places.length == 0) {
      return;
    }

    if (searchMarker) {
      searchMarker.setMap(null);
    }

    // For each place, get the icon, name and location.
    const bounds = new google.maps.LatLngBounds();
    places.forEach(function(place) {
      if (!place.geometry) {
        console.log("Returned place contains no geometry");
        return;
      }

      // Create a marker for each place.
      searchMarker = new google.maps.Marker({
        map: map,
        title: place.name,
        position: place.geometry.location
      });

      if (place.geometry.viewport) {
        // Only geocodes have viewport.
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
  });

  navigator.geolocation.watchPosition(position => {
    const userLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    userMarker.setPosition(userLocation);
    checkGeofences(userLocation);
  }, error => {
    console.error('Error getting user location', error);
  });
}

function checkGeofences(location) {
  let insideAnyGeofence = false;

  for (let circle of circles) {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(location, circle.getCenter());

    if (distance <= circle.getRadius()) {
      insideAnyGeofence = true;

      if (!isInsideGeofence || currentGeofence !== circle) {
        isInsideGeofence = true;
        currentGeofence = circle;
        notifyUser(`You have entered the geofence area at ${location.lat()}, ${location.lng()}.`);
        resetDwellTimer(location);
      }
      break;
    }
  }

  if (!insideAnyGeofence && isInsideGeofence) {
    isInsideGeofence = false;
    currentGeofence = null;
    notifyUser(`You have exited the geofence area at ${location.lat()}, ${location.lng()}.`);
    clearTimeout(dwellTimeout);
  }
}

function resetDwellTimer(location) {
  clearTimeout(dwellTimeout);
  dwellTimeout = setTimeout(() => {
    notifyUser(`You have dwelled in the geofence area for 30 seconds at ${location.lat()}, ${location.lng()}.`);
  }, 30000); // 30 seconds dwell time
}

function notifyUser(message) {
  if (Notification.permission === 'granted') {
    new Notification(message);
  } else {
    console.log('Notification permission not granted');
  }

  // Display custom notification
  const notificationElement = document.getElementById('notification');
  notificationElement.innerText = message;
  notificationElement.classList.add('show');
  setTimeout(() => {
    notificationElement.classList.remove('show');
  }, 5000);
}
