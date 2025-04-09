var map = L.map('map').setView([46, 0], 2); //"L" has already imported by scrip leaflet but the editor doesn't recognize it
//By changing [51.505, -0.09], it changes the start view. However the marker and circle are of higher priority [42,-83]

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const findLocation = (latitude, longitude, name = "") => {
    map.setView([latitude, longitude], 5);
    if (name) {
        L.marker([latitude, longitude]).addTo(map)
            .bindPopup(`<b>${name} found!</b>`).openPopup();
    } else {
        L.marker([latitude, longitude]).addTo(map)
            .bindPopup(`<b>[${latitude}, ${longitude}] found!</b>`).openPopup();
    }
};

document.querySelector("#search-btn").addEventListener("click", () => {
    const searchInput = document.querySelector("#search").value;
    if (searchInput) {
        const coordinates = searchInput.split(',').map(Number);
        if (coordinates.length === 2 && (coordinates[0]) && (coordinates[1])) {
           findLocation(coordinates[0], coordinates[1]);
        } else {
            alert("Invalid coordinates format. Please use 'latitude,longitude'.");
        }
    } else {
        alert("Location not found!");
    }
});

document.querySelector("#place1").addEventListener("click", () => {
    findLocation(31.1, 121.3, "Shanghai");
});

document.querySelector("#place2").addEventListener("click", () => {
    findLocation(48.1, 11.6, "Munich");
});

document.querySelector("#place3").addEventListener("click", () => {
    findLocation(42.3, -83.7, "Ann Arbor");
});

// var marker = L.marker([51.5, -0.09]).addTo(map);
// var circle = L.circle([51.508, -0.11], {
//     color: 'red',
//     fillColor: '#f03',
//     fillOpacity: 0.5,
//     radius: 500
// }).addTo(map);
// var polygon = L.polygon([
//     [51.509, -0.08],
//     [51.503, -0.06],
//     [51.51, -0.047]
// ]).addTo(map);

// marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();
// circle.bindPopup("I am a circle.");
// polygon.bindPopup("I am a polygon.");

// var popup = L.popup()
//     .setLatLng([51.513, -0.09])
//     .setContent("I am a standalone popup.")
//     .openOn(map);

// function onMapClick(e) {
//     alert("You clicked the map at " + e.latlng);
// }

// map.on('click', onMapClick);

// var popup = L.popup();

// function onMapClick(e) {
//     popup
//         .setLatLng(e.latlng)
//         .setContent("You clicked the map at " + e.latlng.toString())
//         .openOn(map);
// }

// map.on('click', onMapClick);