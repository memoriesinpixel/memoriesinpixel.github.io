function normalizeImagePath(path) {
  return path.replace(/^\/+/, '').split('/');
}

function firstCategoryWord(fileName) {
  var base = fileName.replace(/\.[^/.]+$/, '');
  return base.split(/[^A-Za-z0-9]+/)[0] || base;
}

function prettyCategoryName(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function prettyAlbumName(rawAlbumName) {
  return rawAlbumName.replace(/_/g, ' ');
}

function buildAlbumMap(files) {
  var albums = {};

  files.forEach(function(path) {
    var parts = normalizeImagePath(path);
    if (parts.length < 3) return;

    var album = parts[1];
    var fileName = parts[parts.length - 1];
    var categoryKey = firstCategoryWord(fileName).toLowerCase();

    if (!albums[album]) {
      albums[album] = {
        items: [],
        categories: {}
      };
    }

    albums[album].items.push(path);
    albums[album].categories[categoryKey] = true;
  });

  return albums;
}

function initHomePage() {
  var grid = document.getElementById('albums-grid');
  var files = window.galleryFiles;
  var albumMeta = window.albumMeta || {};

  if (!grid || !Array.isArray(files)) return;

  var albumMap = buildAlbumMap(files);
  var albums = Object.keys(albumMap).sort();

  if (!albums.length) {
    grid.innerHTML = '<p class="empty-state">No albums found in the images folder.</p>';
    return;
  }

  albums.forEach(function(albumName) {
    var album = albumMap[albumName];
    var meta = albumMeta[albumName] || {};
    var card = document.createElement('a');
    card.className = 'album-card';
    card.href = meta.url || '#';

    var categoryCount = Object.keys(album.categories).length;

    card.innerHTML =
      '<h3 class="album-title">' + (meta.name || prettyAlbumName(albumName)) + '</h3>' +
      '<p class="album-meta">' + album.items.length + ' photos</p>' +
      '<p class="album-meta">' + categoryCount + ' categories</p>';

    grid.appendChild(card);
  });
}

function groupAlbumCategories(files) {
  var categories = {};

  files.forEach(function(path) {
    var parts = normalizeImagePath(path);
    var fileName = parts[parts.length - 1] || '';
    var categoryKey = firstCategoryWord(fileName).toLowerCase();

    if (!categories[categoryKey]) {
      categories[categoryKey] = {
        label: prettyCategoryName(categoryKey),
        items: []
      };
    }

    categories[categoryKey].items.push(path);
  });

  return categories;
}

function initAlbumPage() {
  var nav = document.getElementById('category-nav');
  var gallery = document.getElementById('album-gallery');
  var files = window.albumFiles;
  var albumName = window.albumName || 'Album';

  if (!nav || !gallery || !Array.isArray(files)) return;

  var categories = groupAlbumCategories(files);
  var categoryKeys = Object.keys(categories).sort();

  if (!categoryKeys.length) {
    gallery.innerHTML = '<p class="empty-state">No photos found for this album.</p>';
    return;
  }

  categoryKeys.forEach(function(key) {
    var category = categories[key];
    var categoryId = 'cat-' + key;

    var navLink = document.createElement('a');
    navLink.className = 'category-pill';
    navLink.href = '#' + categoryId;
    navLink.textContent = category.label + ' (' + category.items.length + ')';
    nav.appendChild(navLink);

    var section = document.createElement('section');
    section.className = 'category-section';
    section.id = categoryId;

    var header = document.createElement('h3');
    header.className = 'category-title';
    header.textContent = category.label;
    section.appendChild(header);

    var grid = document.createElement('div');
    grid.className = 'photo-grid';

    category.items.forEach(function(src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = albumName + ' - ' + category.label;
      img.className = 'photo-thumb';
      img.onclick = function() {
        img.classList.toggle('is-zoomed');
      };
      grid.appendChild(img);
    });

    section.appendChild(grid);
    gallery.appendChild(section);
  });
}

window.addEventListener('load', function() {
  initHomePage();
  initAlbumPage();
});
