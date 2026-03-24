/** set the map variable*/
var map = L.map('map').setView([40, 0], 2);

/** setup the map */
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

/** variables needed */
const storyContainer = document.querySelector('#story-container');
const titleInput = document.querySelector("#title");
const dateInput = document.querySelector("#date");
const descriptionInput = document.querySelector("#description");
const imageInput = document.querySelector("#imageUrl");
const addStoryButton = document.querySelector("#add-story");
const searchButton = document.querySelector("#search-btn");
const storyForm = document.querySelector("#story-form");
const cancelButton = document.querySelector("#cancel-add-story");
const rewriteDescriptionButton = document.querySelector("#rewrite-description-btn");
const cancelRewriteDescriptionButton = document.querySelector("#cancel-rewrite-description-btn");
const rewriteStatusEl = document.querySelector("#rewrite-status");
const recommendTravelButton = document.querySelector("#recommend-travel-btn");
const markers = [];

let descriptionBeforeRewrite = null;

let tempMarker = null; // marker for the current location
let storyList = localStorage.getItem('story.list') ? JSON.parse(localStorage.getItem('story.list')) : defaultEntries;
let coordinate = '';

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Build one entry per visited coordinate for the recommend API.
 */
const buildVisitedPlacesPayload = () => {
  const byCoord = new Map();
  for (const story of storyList) {
    const c = String(story.coordinate || '').trim();
    if (!c) {
      continue;
    }
    if (!byCoord.has(c)) {
      byCoord.set(c, { coordinate: c, titles: [], descriptions: [] });
    }
    const entry = byCoord.get(c);
    if (story.title) {
      entry.titles.push(story.title);
    }
    if (story.description) {
      entry.descriptions.push(story.description);
    }
  }
  return [...byCoord.values()].map((p) => ({
    coordinate: p.coordinate,
    titles: p.titles,
    summary: p.descriptions.join(' ').slice(0, 500)
  }));
};

/**
 * This is a function
 *
 * @param {string} coordinate
 *
 * Renders the story list.
 * when no stories are present, show the form to add a new story
 * when stories are present, show the list of stories and hide the form
 * and anytime the story list changes.
 */
const renderStory = (coordinate) => {
  storyContainer.innerHTML = '';
  storyForm.setAttribute('hidden', '');
  /** sort the stored story based on the coordinate */
  const sortedMemories = storyList.filter(story => story.coordinate == coordinate);
  if (sortedMemories.length === 0) {
    storyForm.removeAttribute('hidden');
    descriptionBeforeRewrite = null;
    if (cancelRewriteDescriptionButton) {
      cancelRewriteDescriptionButton.disabled = true;
    }
    if (rewriteStatusEl) {
      rewriteStatusEl.textContent = '';
    }
    return;
  }
  else {
    sortedMemories.forEach(story => {
      storyContainer.innerHTML += `
        <div class="position-relative col-12 border border-secondary rounded my-3 p-3 bg-white">
        <div class="d-flex">
          <h3>${story.title}</h3>
          <small class="px-1 text-muted align-self-center">${formatDateForStory(story.date)}</small>
        </div>
        <p>${story.description}</p>`;
        if (story.imageUrl) {
          storyContainer.innerHTML +=
            `<img src=${story.imageUrl} alt="Image for ${story.title}">`
        };
      storyContainer.innerHTML +=
      `<button type="button" data-coordinate="${story.coordinate}" class="btn btn-primary mt-3">Delete Story</button>
      </div>`;
    });
  }
}

/**
 * This is a function
 *
 * Resets the overall veiw of the map
 * Renders all markers on map, showing title and date on popup.
 * Should be called on initial load
 * and anytime markers are changed.
 */
const renderMarkers = () => {
  storyForm.setAttribute('hidden', '');
  localStorage.setItem('story.list', JSON.stringify(storyList));
  markers.forEach(marker => map.removeLayer(marker));
  markers.length = 0;
  map.setView([40, 0], 2);
  storyList.forEach(story => {
    const coordinates = story.coordinate.split(',').map(Number);
    const marker = L.marker(coordinates).addTo(map)
      .bindPopup(`<b>${story.title}</b><br>${formatDateForStory(story.date)}`).openPopup()
      .on('click', () => { renderStory(story.coordinate); });
    markers.push(marker);
  });
}

/**
 * This is a function
 *
 * Show Location and temporary marker on map
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} name
 */
const findLocation = (latitude, longitude, name = "", detail = '') => {
  map.setView([latitude, longitude], 5);
  if (tempMarker) {
    map.removeLayer(tempMarker);
  }
  const title = name || `[${latitude}, ${longitude}]`;
  const detailBlock = detail
    ? `<p style="margin:0.5em 0 0 0;">${escapeHtml(detail)}</p>`
    : '';
  tempMarker = L.marker([latitude, longitude])
    .addTo(map)
    .bindPopup(`<b>${escapeHtml(title)} found!</b>${detailBlock}`)
    .openPopup();
};

/**
 * Implement the search function
 * Split the input string by comma and convert to number
 * Check if the input is valid
 * If valid, set the coordinate and call findLocation function
 * If invalid, alert the user
 */
searchButton.addEventListener("click", () => {
  const searchInput = document.querySelector("#search").value.trim();
  const coordinates = searchInput.split(',').map(Number);
  if (coordinates.length === 2 && (coordinates[0]) && (coordinates[1])) {
    coordinate = searchInput;
    findLocation(coordinates[0], coordinates[1]);
    renderStory(coordinate);
  } else {
    alert("Invalid coordinates format. Please use 'latitude,longitude'.");
  }
});

if (recommendTravelButton) {
  recommendTravelButton.addEventListener('click', async () => {
    const places = buildVisitedPlacesPayload();
    if (places.length === 0) {
      alert('Add at least one travel story so we can recommend your next place.');
      return;
    }
    const prevLabel = recommendTravelButton.textContent;
    recommendTravelButton.disabled = true;
    recommendTravelButton.textContent = 'Recommending...';
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ places })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || 'Recommendation failed');
      }
      const { name, latitude, longitude, reason } = data;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Invalid coordinates in response');
      }
      coordinate = `${latitude},${longitude}`;
      findLocation(latitude, longitude, name || 'Recommended place', reason || '');
      renderStory(coordinate);
    } catch (e) {
      alert(e.message || 'Recommendation failed');
    } finally {
      recommendTravelButton.disabled = false;
      recommendTravelButton.textContent = prevLabel;
    }
  });
}

/**
 * Cancel adding a new story
 * This also function as deletion of the marker by rendering the markers again
 */
cancelButton.addEventListener('click', () => {
  if (tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
  renderMarkers();
})

const resetRewriteUi = () => {
  descriptionBeforeRewrite = null;
  if (cancelRewriteDescriptionButton) {
    cancelRewriteDescriptionButton.disabled = true;
  }
  if (rewriteStatusEl) {
    rewriteStatusEl.textContent = '';
  }
  if (rewriteDescriptionButton) {
    rewriteDescriptionButton.disabled = false;
    rewriteDescriptionButton.textContent = 'Rewrite';
  }
}

rewriteDescriptionButton.addEventListener('click', async () => {
  if (!rewriteStatusEl || !rewriteDescriptionButton || !cancelRewriteDescriptionButton) {
    return;
  }
  rewriteStatusEl.textContent = '';
  const text = descriptionInput.value.trim();
  if (!text) {
    alert('Please enter a description to rewrite.');
    return;
  }
  descriptionBeforeRewrite = descriptionInput.value;
  rewriteDescriptionButton.disabled = true;
  rewriteDescriptionButton.textContent = 'Polishing...';
  try {
    const res = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || res.statusText || 'Rewrite failed');
    }
    if (!data.polished) {
      throw new Error('No polished text returned');
    }
    descriptionInput.value = data.polished;
    cancelRewriteDescriptionButton.disabled = false;
    rewriteStatusEl.textContent = 'Polished. Use Cancel to restore your original text.';
  } catch (e) {
    alert(e.message || 'Rewrite failed');
    descriptionBeforeRewrite = null;
    cancelRewriteDescriptionButton.disabled = true;
  } finally {
    rewriteDescriptionButton.disabled = false;
    rewriteDescriptionButton.textContent = 'Rewrite';
  }
});

cancelRewriteDescriptionButton.addEventListener('click', () => {
  if (descriptionBeforeRewrite === null) {
    return;
  }
  descriptionInput.value = descriptionBeforeRewrite;
  resetRewriteUi();
})

/**
 * Takes the value of a date input and formats it in the manner required by the story list.
 *
 * @param {string} dateString
 *   The date input value.
 * @return {string}
 *   The date formatted like "Monday, Mar 3, 2003".
 */
const formatDateForStory = (dateString) =>
  new Date(dateString).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })

/**
 * Converts a date string into a timestamp that accounts for the current time zone.
 *
 * @param {string} dateString
 *   The value of a date input.
 *
 * @return {number}
 *   A JS-friendly millisecond timestamp.
 */
const localizedTimestamp = (dateString) =>
  new Date(dateString).getTime() + new Date(dateString).getTimezoneOffset() * 60000

/**Check whether the form meets condition and ready to submit
 * title, date and description are required
 * imageUrl is optional
 * store story in story list and render the list
 * reset the form fields
 */
addStoryButton.addEventListener('click', () => {
  if (titleInput.value === '') {
    document.querySelector("#title-feedback").removeAttribute('hidden');
    titleInput.classList.add('is-invalid');
  }
  else {
    document.querySelector("#title-feedback").setAttribute('hidden', '');
    titleInput.classList.remove('is-invalid');
  }
  if (dateInput.value === '') {
    document.querySelector("#date-feedback").removeAttribute('hidden');
    dateInput.classList.add('is-invalid');
  }
  else {
    document.querySelector("#date-feedback").setAttribute('hidden', '');
    dateInput.classList.remove('is-invalid');
  }
  if (descriptionInput.value === '') {
    document.querySelector("#description-feedback").removeAttribute('hidden');
    descriptionInput.classList.add('is-invalid');
  }
  else {
    document.querySelector("#description-feedback").setAttribute('hidden', '');
    descriptionInput.classList.remove('is-invalid');
  }
  if (titleInput.classList.contains('is-invalid') || dateInput.classList.contains('is-invalid') || descriptionInput.classList.contains('is-invalid')) {
    return;
  }
  else {
    storyList.push({
      title: titleInput.value,
      date: localizedTimestamp(dateInput.value),
      description: descriptionInput.value,
      coordinate: coordinate,
      imageUrl: imageInput.value
    });

    if (tempMarker) {
      map.removeLayer(tempMarker);
      tempMarker = null;
    }

    titleInput.value = '';
    dateInput.value = '';
    descriptionInput.value = '';
    imageInput.value = '';
    resetRewriteUi();
    renderStory(coordinate);
    renderMarkers();
  }
})

/**Remove story by clicking "Delete Story" button
 * render the updated list
 */
storyContainer.addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-coordinate')) {
    const dataCoordinate = e.target.getAttribute('data-coordinate');
    storyList = storyList.filter(story => story.coordinate !== dataCoordinate);
    renderStory(coordinate);
    renderMarkers();
  }
})

// shortcut buttons
const placeButtons = {
  place1: [31.1, 121.3, "Shanghai"],
  place2: [48.1, 11.6, "Munich"],
  place3: [42.3, -83.7, "Ann Arbor"],
  place4: [48.2, 16.4, "Vienna"],
  place5: [41.4, 2.2, "Barcelona"],
  place6: [28.5, -81.4, "Orlando"]
};

Object.entries(placeButtons).forEach(([id, [lat, lng, name]]) => {
  document.querySelector(`#${id}`).addEventListener("click", () => {
    coordinate = `${lat},${lng}`;
    findLocation(lat, lng, name);
    renderStory(coordinate);
  });
});

// render markers on pageload (as well as when new story is added)
renderMarkers();