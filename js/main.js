var renderer, scene, camera, cenital, clock, stats;
var player, playerMarker, exitZone, skybox;
var gameState = 'intro';
var gameTime = 0;
var levelTime = 0;
var levelTimes = [];
var playerName = loadPlayerName();

var alertLevel = 0;
var ALERT_FILL_TIME = 0.45;
var ALERT_EMPTY_TIME = 3.0;
var ENEMY_SPEED_FACTOR = 1.15;
var VISION_RANGE_FACTOR = 1.1;
var ALERT_COLOR = new THREE.Color(0xff2738);
var currentLevel = 0;
var levelToken = 0;
var firstPerson = true;

var levelNames = [
  'Prácticas del máster IARFID',
  'Pasillos del edificio 1B',
  'Campus de Vera'
];
var levelEscapes = [
  'de la clase de prácticas del máster IARFID',
  'de los pasillos del edificio 1B',
  'del campus de Vera'
];
var levelHints = [
  'Escóndete tras los racks del laboratorio de prácticas',
  'Cruza por las puertas iluminadas de los pasillos del 1B',
  'Usa setos y palmeras como cobertura y vigila el coche patrulla'
];

var colliders = [];
var occluders = [];
var securityCameras = [];
var guards = [];
var policeCars = [];
var mixers = [];

var textureLoader = new THREE.TextureLoader();
var fbxLoader = new THREE.FBXLoader();
var gltfLoader = new THREE.GLTFLoader();
var textureCache = {};
var environmentMap = null;
var pendingLoads = 0;

var GUARD_MODEL = 'models/Unarmed Walk Forward.fbx';
var PLAYER_MODEL = 'models/Sneaking Forward.fbx';
var PLAYER_MODEL_SCALE = 0.01;
var PLAYER_ANIMATION_SPEED = 2.2;
var PLAYER_IDLE_ANIMATION = 'models/Idle.fbx';
var playerModel = null;
var playerModelLoading = false;
var GUARD_MODEL_SCALE = 0.01;
var GUARD_WALK_SPEED = 1.3;
var CAR_MODEL = 'models/police-car/scene.gltf';
var CAMERA_MODEL = 'models/security_camera/scene.gltf';
var CAMERA_HEIGHT = 2.7;
var CAMERA_ARM_LENGTH = 0.65;
var modelCache = {};
var CAR_LENGTH = 5.0;

var SKYBOX_FACES = [
  'images/skybox/Right.jpg', 'images/skybox/Left.jpg',
  'images/skybox/Up.jpg', 'images/skybox/Down.jpg',
  'images/skybox/Front.jpg', 'images/skybox/Back.jpg'
];

var visionRaycaster = new THREE.Raycaster();
var cameraRaycaster = new THREE.Raycaster();
var playerStart = new THREE.Vector3(-13, 0.03, 8.6);
var exitPosition = new THREE.Vector3(13, 0, -9);
var viewYaw = 0;
var viewPitch = -0.06;
var MOUSE_SENSITIVITY = 0.0022;

var PLAYER_RADIUS = 0.55;
var PLAYER_SPEED = 4.8;
var PLAYER_EYE_HEIGHT = 1.62;
var THIRD_PERSON_DISTANCE = 4.2;
var THIRD_PERSON_HEIGHT = 2.1;

var introAnimation = { progress: 1 };

var controls = {
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false
};

init();
loadScene();
render();

function init()
{
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(0x101722));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.autoClear = false;
  renderer.shadowMap.autoUpdate = false;
  document.getElementById('container').appendChild(renderer.domElement);

  stats = new Stats();
  stats.showPanel(0);
  stats.domElement.style.left = 'auto';
  stats.domElement.style.right = '16px';
  document.getElementById('container').appendChild(stats.domElement);

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(68, aspectRatio, 0.05, 400);

  cenital = new THREE.OrthographicCamera(-14, 14, 14, -14, 36.3, 80);
  cenital.position.set(0, 40, 0);
  cenital.up.set(0, 0, -1);
  cenital.lookAt(0, 0, 0);

  environmentMap = new THREE.CubeTextureLoader().load(SKYBOX_FACES);
  environmentMap.encoding = THREE.sRGBEncoding;

  window.addEventListener('resize', updateAspectRatio);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  window.addEventListener('blur', clearControls);
  renderer.domElement.addEventListener('click', requestMouseControl);
  document.getElementById('player-name').value = playerName;
  document.getElementById('start-form').addEventListener('submit', startFromForm);
  showRanking();
  document.getElementById('restart-button').addEventListener('click', handleResultAction);
}

function loadScene()
{
  var requestedLevel = Number(
    new URLSearchParams(window.location.search).get('nivel')
  ) - 1;
  var initialLevel = requestedLevel >= 0 && requestedLevel < levelNames.length
    ? requestedLevel
    : 0;
  loadLevel(initialLevel);
}

function loadLevel(levelIndex)
{
  if (levelIndex === 0) levelTimes = [];
  levelTime = 0;
  currentLevel = levelIndex;
  levelToken++;
  gameTime = 0;
  clearControls();

  scene = new THREE.Scene();
  colliders = [];
  occluders = [];
  securityCameras = [];
  guards = [];
  policeCars = [];
  mixers = [];
  skybox = null;
  pendingLoads = 0;

  if (currentLevel === 2) {
    scene.background = new THREE.Color(0x8ebed9);
  } else if (currentLevel === 1) {
    scene.background = new THREE.Color(0x182331);
  } else {
    scene.background = new THREE.Color(0x101722);
  }

  createLights();

  if (currentLevel === 0) {
    createDataCenterLevel();
  } else if (currentLevel === 1) {
    createOfficeLevel();
  } else {
    createOutdoorLevel();
  }

  player = createPlayer();
  player.visible = !firstPerson;
  scene.add(player);
  loadPlayerModel();

  playerMarker = createPlayerMarker();
  scene.add(playerMarker);

  exitZone = createExit();
  scene.add(exitZone);

  updateLevelHud();
  updateLoadingHud();
  resetGame();
}

function loadTexture(path, repeatX, repeatY)
{
  var key = path + '|' + repeatX + '|' + repeatY;
  if (textureCache[key]) return textureCache[key];

  var texture = textureLoader.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textureCache[key] = texture;
  return texture;
}

function createMatteMaterial(color, texture)
{
  var options = { color: color };
  if (texture) options.map = texture;
  return new THREE.MeshLambertMaterial(options);
}

function createShinyMaterial(color, texture, shininess, specular)
{
  var options = {
    color: color,
    shininess: shininess || 60,
    specular: specular || 0x666666
  };
  if (texture) options.map = texture;
  return new THREE.MeshPhongMaterial(options);
}

function createGlowMaterial(color)
{
  return new THREE.MeshBasicMaterial({ color: color });
}

function createLights()
{
  var outdoor = currentLevel === 2;
  var office = currentLevel === 1;

  var ambient = new THREE.AmbientLight(
    outdoor ? 0xbfd4e6 : (office ? 0xb9c6d8 : 0x8fa6c0),
    outdoor ? 0.5 : (office ? 0.42 : 0.38)
  );
  ambient.name = 'luz ambiental';
  scene.add(ambient);

  var mainLight = new THREE.DirectionalLight(
    outdoor ? 0xfff1ce : (office ? 0xe8f1ff : 0xffffff),
    outdoor ? 1.0 : (office ? 0.6 : 0.7)
  );
  mainLight.name = 'luz direccional';
  mainLight.position.set(-12, outdoor ? 28 : 18, 14);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.left = -32;
  mainLight.shadow.camera.right = 32;
  mainLight.shadow.camera.top = 28;
  mainLight.shadow.camera.bottom = -28;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 70;
  mainLight.shadow.bias = -0.0004;
  scene.add(mainLight);

  var fillLight = new THREE.PointLight(
    outdoor ? 0xaac8ff : 0x7fb0ff,
    outdoor ? 0.25 : 0.3,
    60,
    1.2
  );
  fillLight.name = 'luz puntual de relleno';
  fillLight.position.set(14, 10, -12);
  scene.add(fillLight);
}

function createDataCenterLevel()
{
  playerStart.set(-13, 0.03, 8.6);
  exitPosition.set(13, 0, -9);

  createWarehouse();

  createSecurityCamera(-15.2, 1, Math.PI / 2, 0.72, 0.0);
  createSecurityCamera(3, -11.2, 0, 0.68, 1.8);
  createSecurityCamera(15.2, 5, -Math.PI / 2, 0.62, 3.4);
  createSecurityCamera(6, 11.2, Math.PI, 0.5, 0.8, 9);

  var dataGuard = { speed: 2.0 };
  createGuard([
    [-12, -7], [-5, -7], [-5, -4], [-12, -4]
  ], 0.0, dataGuard);
  createGuard([
    [7, 3], [13, 3], [13, 0], [7, 0]
  ], 1.5, dataGuard);
  createGuard([
    [4, -9.6], [13, -9.6]
  ], 0.7, dataGuard);
  createGuard([
    [0, 9.6], [13, 9.6]
  ], 1.0, dataGuard);
}

function createCeiling(width, depth, height, color)
{
  var ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createMatteMaterial(color)
  );
  ceiling.name = 'techo';
  ceiling.position.y = height;
  ceiling.rotation.x = Math.PI / 2;
  scene.add(ceiling);
}

function createFloor(width, depth, material, name)
{
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  floor.name = name || 'suelo';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}

function createWarehouse()
{
  createCeiling(32, 24, 4.15, 0x263544);

  createFloor(32, 24, createShinyMaterial(
    0x8f9aa6,
    loadTexture('images/pisometalico_1024.jpg', 8, 6),
    90,
    0x8a8a8a
  ));

  var wallMaterial = createMatteMaterial(
    0x55677a,
    loadTexture('images/metal_128.jpg', 10, 2)
  );

  createStaticBox('pared norte', 0, 1.6, -11.6, 32, 3.2, 0.8, wallMaterial);
  createStaticBox('pared sur', 0, 1.6, 11.6, 32, 3.2, 0.8, wallMaterial);
  createStaticBox('pared oeste', -15.6, 1.6, 0, 0.8, 3.2, 24, wallMaterial);
  createStaticBox('pared este', 15.6, 1.6, 0, 0.8, 3.2, 24, wallMaterial);

  createLightStrip(0, 0.32, -11.14, 30, 0.1);
  createLightStrip(0, 0.32, 11.14, 30, 0.1);
  createLightStrip(-15.14, 0.32, 0, 0.1, 22);
  createLightStrip(15.14, 0.32, 0, 0.1, 22);

  var partitionMaterial = createMatteMaterial(
    0x6f8294,
    loadTexture('images/metal_128.jpg', 3, 2)
  );
  createStaticBox('tabique central', -2.5, 1.35, 1.5, 0.8, 2.7, 7, partitionMaterial);
  createStaticBox('tabique inferior', 6, 1.35, -3, 6, 2.7, 0.8, partitionMaterial);

  createServerBank(-9, 6, 4, 3, 2.7);
  createServerBank(-8, -1, 3, 4, 2.8);
  createServerBank(1, 7, 4, 3, 2.6);
  createServerBank(4, 2, 3, 3, 2.9);
  createServerBank(10, 5, 3, 3, 2.6);
  createServerBank(9, -6, 4, 3, 2.7);
  createServerBank(0, -7, 4, 3, 2.6);
}

function createStaticBox(name, x, y, z, width, height, depth, material)
{
  var mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  });

  occluders.push(mesh);
  return mesh;
}

function createLightStrip(x, y, z, width, depth)
{
  var strip = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.09, depth),
    createGlowMaterial(0x5ebbd1)
  );
  strip.name = 'tira luminosa';
  strip.position.set(x, y, z);
  scene.add(strip);
}

function createServerBank(x, z, width, depth, height)
{
  var group = new THREE.Group();
  group.name = 'banco de servidores';
  group.position.set(x, 0, z);

  var metalTexture = loadTexture('images/metal_128.jpg', 1, 2);
  var frameMaterial = createShinyMaterial(0x4d6072, metalTexture, 80, 0x9fb3c8);
  var panelMaterial = createShinyMaterial(0x1a222c, null, 45, 0x556677);
  var moduleMaterial = createShinyMaterial(0x8ea2b5, metalTexture, 100, 0xcfdce8);
  var blueLedMaterial = createGlowMaterial(0x5de7ff);
  var greenLedMaterial = createGlowMaterial(0x67ff9a);

  var cabinetCount = Math.max(2, Math.round(width / 1.25));
  var gap = 0.12;
  var cabinetWidth = (width - gap * (cabinetCount + 1)) / cabinetCount;
  var cabinetDepth = depth - 0.18;

  for (var cabinetIndex = 0; cabinetIndex < cabinetCount; cabinetIndex++) {
    var cabinet = new THREE.Group();
    cabinet.name = 'armario servidor';
    cabinet.position.x = -width / 2 + gap + cabinetWidth / 2 +
      cabinetIndex * (cabinetWidth + gap);

    var frame = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetWidth, height, cabinetDepth),
      frameMaterial
    );
    frame.position.y = height / 2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    cabinet.add(frame);
    occluders.push(frame);

    var frontPanel = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetWidth - 0.1, height - 0.22, 0.06),
      panelMaterial
    );
    frontPanel.position.set(0, height / 2, cabinetDepth / 2 + 0.035);
    cabinet.add(frontPanel);

    var moduleCount = 6;
    for (var moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
      var moduleY = 0.32 + moduleIndex * ((height - 0.58) / (moduleCount - 1));
      var serverModule = new THREE.Mesh(
        new THREE.BoxGeometry(cabinetWidth - 0.18, 0.13, 0.045),
        moduleMaterial
      );
      serverModule.position.set(0, moduleY, cabinetDepth / 2 + 0.075);
      cabinet.add(serverModule);

      var led = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.055, 0.025),
        moduleIndex % 3 === 0 ? greenLedMaterial : blueLedMaterial
      );
      led.position.set(
        cabinetWidth / 2 - 0.17,
        moduleY,
        cabinetDepth / 2 + 0.105
      );
      cabinet.add(led);
    }

    var topLight = new THREE.Mesh(
      new THREE.BoxGeometry(cabinetWidth - 0.14, 0.07, 0.035),
      blueLedMaterial
    );
    topLight.position.set(0, height - 0.16, cabinetDepth / 2 + 0.105);
    cabinet.add(topLight);
    group.add(cabinet);
  }

  var base = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, 0.12, depth + 0.14),
    frameMaterial
  );
  base.position.y = 0.06;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  scene.add(group);

  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  });
}

function createOfficeLevel()
{
  playerStart.set(-19, 0.03, 13);
  exitPosition.set(19, 0, -13);

  createFloor(44, 32, createShinyMaterial(
    0xc9b59a,
    loadTexture('images/wood512.jpg', 11, 8),
    70,
    0x777777
  ));
  createCeiling(44, 32, 4.1, 0x344252);

  var exteriorMaterial = createMatteMaterial(
    0x6b7b8c,
    loadTexture('images/metal_128.jpg', 12, 2)
  );
  var officeWallMaterial = createMatteMaterial(0x8795a3);

  createStaticBox('pared oficina norte', 0, 1.6, -15.6, 44, 3.2, 0.8, exteriorMaterial);
  createStaticBox('pared oficina sur', 0, 1.6, 15.6, 44, 3.2, 0.8, exteriorMaterial);
  createStaticBox('pared oficina oeste', -21.6, 1.6, 0, 0.8, 3.2, 32, exteriorMaterial);
  createStaticBox('pared oficina este', 21.6, 1.6, 0, 0.8, 3.2, 32, exteriorMaterial);

  createCeilingLamp(-16, 8);
  createCeilingLamp(-16, -7);
  createCeilingLamp(-5, 6);
  createCeilingLamp(5, -6);
  createCeilingLamp(16, 7);
  createCeilingLamp(16, -8);

  createStaticBox('pasillo uno norte', -10, 1.45, -10, 0.7, 2.9, 10, officeWallMaterial);
  createStaticBox('pasillo uno sur', -10, 1.45, 8, 0.7, 2.9, 14, officeWallMaterial);
  createStaticBox('pasillo dos norte', 0, 1.45, -11.5, 0.7, 2.9, 7, officeWallMaterial);
  createStaticBox('pasillo dos sur', 0, 1.45, 6.5, 0.7, 2.9, 17, officeWallMaterial);
  createStaticBox('pasillo tres norte', 10, 1.45, -9.5, 0.7, 2.9, 11, officeWallMaterial);
  createStaticBox('pasillo tres sur', 10, 1.45, 8.5, 0.7, 2.9, 13, officeWallMaterial);

  var doorMaterial = createGlowMaterial(0x2b5560);
  createGroundPatch(-10, -2, 3.2, 5.5, doorMaterial);
  createGroundPatch(0, -5, 3.2, 5.5, doorMaterial);
  createGroundPatch(10, -1, 3.2, 5.5, doorMaterial);

  createOfficeDesk(-16, 6, 3.4, 1.8);
  createOfficeDesk(-16, -4, 3.4, 1.8);
  createOfficeDesk(-5, 4, 3.2, 1.8);
  createOfficeDesk(-5, 9, 3.2, 1.8);
  createOfficeDesk(5, 5, 3.2, 1.8);
  createOfficeDesk(5, -5, 3.2, 1.8);
  createOfficeDesk(16, 9, 3.4, 1.8);
  createOfficeDesk(16, -4, 3.4, 1.8);

  createSecurityCamera(-21.2, 5, Math.PI / 2, 0.6, 0.2, 9.5, 27);
  createSecurityCamera(-9.65, -6, Math.PI / 2, 0.58, 1.5, 9.5, 27);
  createSecurityCamera(9.65, -5, -Math.PI / 2, 0.58, 3.0, 9.5, 27);
  createSecurityCamera(21.2, -8, -Math.PI / 2, 0.6, 4.5, 9.5, 27);
  createSecurityCamera(5, -15.2, 0, 0.7, 2.0, 9.5, 27);

  var officeGuard = { speed: 1.9, range: 7.5, angle: 32 };
  createGuard([
    [-12, 10], [-12, 2], [-19, 2], [-19, 10]
  ], 0.0, officeGuard);
  createGuard([
    [-8, -1], [-2, -1], [-2, -11], [-8, -11]
  ], 1.2, officeGuard);
  createGuard([
    [12, 7], [19, 7], [19, -10], [12, -10]
  ], 2.4, officeGuard);
  createGuard([
    [2, 1], [8, 1], [8, 12], [2, 12]
  ], 0.6, officeGuard);
  createGuard([
    [2, -13], [8, -13], [8, -8], [2, -8]
  ], 1.8, officeGuard);
}

function createCeilingLamp(x, z)
{
  var light = new THREE.PointLight(0xdceaff, 0.42, 11, 1.8);
  light.name = 'luz del techo';
  light.position.set(x, 3.6, z);
  scene.add(light);
}

function createOfficeDesk(x, z, width, depth)
{
  var group = new THREE.Group();
  group.name = 'puesto de oficina';
  group.position.set(x, 0, z);

  var deskMaterial = createShinyMaterial(
    0xd2b690,
    loadTexture('images/wood512.jpg', 1, 1),
    55,
    0x555555
  );
  var metalMaterial = createShinyMaterial(0x4a5968, null, 90, 0xaabbcc);
  var screenMaterial = createGlowMaterial(0x2e9ab7);
  var partitionMaterial = new THREE.MeshLambertMaterial({
    color: 0x7f93a3,
    transparent: true,
    opacity: 0.92
  });

  var top = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.14, depth),
    deskMaterial
  );
  top.position.y = 0.78;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  occluders.push(top);

  [-1, 1].forEach(function(side) {
    var leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, depth - 0.18),
      metalMaterial
    );
    leg.position.set(side * (width / 2 - 0.18), 0.36, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  var partition = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.35, 0.1),
    partitionMaterial
  );
  partition.position.set(0, 1.05, -depth / 2 + 0.05);
  partition.castShadow = true;
  group.add(partition);
  occluders.push(partition);

  [-0.25, 0.25].forEach(function(screenOffset) {
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.32, 0.48, 0.08),
      screenMaterial
    );
    screen.position.set(screenOffset * width, 1.13, -0.1);
    screen.castShadow = true;
    group.add(screen);
  });

  scene.add(group);
  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  });
}

function createOutdoorLevel()
{
  playerStart.set(-23, 0.03, 16);
  exitPosition.set(23, 0, -16);

  createSkybox();

  createFloor(160, 160, createMatteMaterial(
    0xffffff,
    loadTexture('images/grass.png', 40, 40)
  ), 'hierba');

  createRoad(-4, 4, -19, 19);
  createRoad(-26, -4, 8, 12);
  createRoad(4, 26, 8, 12);
  createRoad(4, 26, -12, -8);
  createRoad(20, 24, -8, 8);

  createFenceSegment(0, -18.7, 52, true);
  createFenceSegment(0, 18.7, 52, true);
  createFenceSegment(-25.7, 0, 38, false);
  createFenceSegment(25.7, 0, 38, false);

  createPalmTree(-16, 14, 1.0);
  createPalmTree(-15, -2, 0.92);
  createPalmTree(-13, -12, 1.05);
  createPalmTree(-7, 14, 0.9);
  createPalmTree(6, 15, 1.0);
  createPalmTree(15, 14, 1.05);
  createPalmTree(18, -7, 0.92);
  createPalmTree(7, -14, 1.0);

  createHedge(-11, 5, 6, 1.2, 1.25);
  createHedge(-8, -7, 1.2, 6, 1.35);
  createHedge(8, 3, 1.2, 6, 1.35);
  createHedge(14, -2, 6, 1.2, 1.25);
  createHedge(-18, -5, 4, 1.2, 1.25);
  createHedge(7.5, -3, 5, 1.2, 1.25);
  createHedge(18, -5, 4, 1.2, 1.25);
  createHedge(19, -12, 4, 1.2, 1.25);

  createPoliceCar(12, 15, Math.PI / 2, null);
  createPoliceCar(0, 10, Math.PI, [
    [0, 10], [0, -10], [22, -10], [22, 10]
  ]);

  createSecurityCamera(-24.8, 5, Math.PI / 2, 0.65, 0.0, 11.5, 28);
  createSecurityCamera(-10, -17.8, 0, 0.62, 1.2, 11.5, 28);
  createSecurityCamera(12, -17.8, 0, 0.62, 2.5, 11.5, 28);
  createSecurityCamera(24.8, 7, -Math.PI / 2, 0.65, 3.8, 11.5, 28);

  var outdoorGuard = { speed: 2.0, range: 8.2, angle: 33 };
  createGuard([
    [-22, 10], [-18, 10], [-18, 3], [-22, 3]
  ], 0.0, outdoorGuard);
  createGuard([
    [-12, -2], [-6, -2], [-6, 3], [-12, 3]
  ], 1.1, outdoorGuard);
  createGuard([
    [10, 0], [17, 0], [17, 7], [10, 7]
  ], 2.2, outdoorGuard);
  createGuard([
    [14, -15], [21, -15]
  ], 0.4, outdoorGuard);
  createGuard([
    [-5, -15], [5, -15]
  ], 0.8, outdoorGuard);
}

function createSkybox()
{
  var materials = SKYBOX_FACES.map(function(path) {
    var texture = textureLoader.load(path);
    texture.encoding = THREE.sRGBEncoding;
    return new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
  });

  skybox = new THREE.Mesh(new THREE.BoxGeometry(400, 400, 400), materials);
  skybox.name = 'cielo';
  scene.add(skybox);
}

var ROAD_TILE = 6;

function createRoad(minX, maxX, minZ, maxZ)
{
  var centerX = (minX + maxX) / 2;
  var centerZ = (minZ + maxZ) / 2;
  var geometry = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ);

  var position = geometry.attributes.position;
  var uv = geometry.attributes.uv;
  for (var i = 0; i < position.count; i++) {
    var worldX = centerX + position.getX(i);
    var worldZ = centerZ - position.getY(i);
    uv.setXY(i, worldX / ROAD_TILE, -worldZ / ROAD_TILE);
  }

  var road = new THREE.Mesh(geometry, createShinyMaterial(
    0x7d868c,
    loadTexture('images/wet_ground_512x512.jpg', 1, 1),
    18,
    0x3c4852
  ));
  road.name = 'carretera';
  road.position.set(centerX, 0.018, centerZ);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);
}

function createGroundPatch(x, z, width, depth, material)
{
  var patch = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  patch.name = 'camino';
  patch.position.set(x, 0.018, z);
  patch.rotation.x = -Math.PI / 2;
  patch.receiveShadow = true;
  scene.add(patch);
}

function createFenceSegment(x, z, length, horizontal)
{
  var group = new THREE.Group();
  group.name = 'valla exterior';
  group.position.set(x, 0, z);

  var fenceMaterial = createShinyMaterial(
    0x6b7a84,
    loadTexture('images/metal_128.jpg', 1, 1),
    120,
    0xcccccc
  );

  [0.65, 1.55].forEach(function(railHeight) {
    var rail = new THREE.Mesh(
      new THREE.BoxGeometry(
        horizontal ? length : 0.09,
        0.09,
        horizontal ? 0.09 : length
      ),
      fenceMaterial
    );
    rail.position.y = railHeight;
    rail.castShadow = false;
    group.add(rail);
  });

  var postCount = Math.floor(length / 3);
  for (var i = 0; i <= postCount; i++) {
    var offset = -length / 2 + i * (length / postCount);
    var post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.2, 0.14),
      fenceMaterial
    );
    post.position.set(horizontal ? offset : 0, 1.1, horizontal ? 0 : offset);
    post.castShadow = false;
    group.add(post);
  }

  scene.add(group);
  var thickness = 0.42;
  colliders.push({
    minX: x - (horizontal ? length / 2 : thickness / 2),
    maxX: x + (horizontal ? length / 2 : thickness / 2),
    minZ: z - (horizontal ? thickness / 2 : length / 2),
    maxZ: z + (horizontal ? thickness / 2 : length / 2)
  });
}

function createPalmTree(x, z, scale)
{
  var group = new THREE.Group();
  group.name = 'palmera';
  group.position.set(x, 0, z);

  var trunkHeight = 3.6 * scale;
  var trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.32 * scale, trunkHeight, 10),
    createMatteMaterial(0xa07a4c, loadTexture('images/wood512.jpg', 1, 3))
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);
  occluders.push(trunk);

  var leafMaterial = new THREE.MeshLambertMaterial({
    color: 0x2f8a46,
    side: THREE.DoubleSide
  });
  for (var i = 0; i < 8; i++) {
    var angle = (i / 8) * Math.PI * 2;
    var leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.5 * scale, 10, 6),
      leafMaterial
    );
    leaf.scale.set(0.45, 0.12, 2.6);
    leaf.position.set(
      Math.sin(angle) * 0.82 * scale,
      trunkHeight + 0.08,
      Math.cos(angle) * 0.82 * scale
    );
    leaf.rotation.y = angle;
    leaf.castShadow = true;
    group.add(leaf);
  }

  var coconutMaterial = createMatteMaterial(0x4b321f);
  for (var coconutIndex = 0; coconutIndex < 3; coconutIndex++) {
    var coconut = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 * scale, 8, 6),
      coconutMaterial
    );
    coconut.position.set(
      (coconutIndex - 1) * 0.18 * scale,
      trunkHeight - 0.12,
      0.12 * scale
    );
    coconut.castShadow = false;
    group.add(coconut);
  }

  scene.add(group);
  var trunkRadius = 0.38 * scale;
  colliders.push({
    minX: x - trunkRadius,
    maxX: x + trunkRadius,
    minZ: z - trunkRadius,
    maxZ: z + trunkRadius
  });
}

function createHedge(x, z, width, depth, height)
{
  var hedge = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth, 3, 2, 3),
    createMatteMaterial(0x4f9a3f, loadTexture('images/grass.png', 2, 1))
  );
  hedge.name = 'seto';
  hedge.position.set(x, height / 2 + 0.15, z);
  hedge.castShadow = true;
  hedge.receiveShadow = true;
  scene.add(hedge);
  occluders.push(hedge);

  var planter = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.22, 0.3, depth + 0.22),
    createMatteMaterial(0xa59680)
  );
  planter.position.set(x, 0.15, z);
  planter.castShadow = false;
  planter.receiveShadow = true;
  scene.add(planter);

  colliders.push({
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  });
}

function createPoliceCar(x, z, angle, routeCoordinates)
{
  var group = new THREE.Group();
  group.name = routeCoordinates ? 'coche patrulla' : 'coche aparcado';
  group.position.set(x, 0, z);
  group.rotation.y = angle;

  var beacon = new THREE.PointLight(0xff2a2a, 1.1, 9, 1.5);
  beacon.name = 'luz del puente';
  beacon.position.set(0, 2.0, -0.4);
  group.add(beacon);

  var car = {
    group: group,
    beacon: beacon,
    route: null,
    routeIndex: 1,
    speed: 5.5 * ENEMY_SPEED_FACTOR,
    range: 11 * VISION_RANGE_FACTOR,
    halfAngle: THREE.MathUtils.degToRad(18),
    field: null
  };

  if (routeCoordinates) {
    car.route = routeCoordinates.map(function(point) {
      return new THREE.Vector3(point[0], 0, point[1]);
    });

    var headlight = new THREE.SpotLight(
      0xfff0c8, 1.3, 16, THREE.MathUtils.degToRad(24), 0.45, 1.2
    );
    headlight.name = 'faros';
    headlight.position.set(0, 0.95, 2.1);
    var target = new THREE.Object3D();
    target.position.set(0, 0.2, 14);
    group.add(target);
    headlight.target = target;
    group.add(headlight);

    car.field = createVisionField(car.range, car.halfAngle, 0xff8738, 0.2);
    car.field.position.set(0, 0.03, CAR_LENGTH / 2);
    group.add(car.field);
  } else {
    var alongX = Math.abs(Math.sin(angle)) > 0.5;
    colliders.push({
      minX: x - (alongX ? CAR_LENGTH / 2 : 1.1),
      maxX: x + (alongX ? CAR_LENGTH / 2 : 1.1),
      minZ: z - (alongX ? 1.1 : CAR_LENGTH / 2),
      maxZ: z + (alongX ? 1.1 : CAR_LENGTH / 2)
    });

    var blocker = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.5, CAR_LENGTH),
      new THREE.MeshBasicMaterial()
    );
    blocker.name = 'cobertura del coche';
    blocker.position.y = 0.75;
    blocker.visible = false;
    group.add(blocker);
    occluders.push(blocker);
  }

  scene.add(group);
  policeCars.push(car);
  loadCarModel(group);
}

function loadCarModel(group)
{
  var token = levelToken;
  pendingLoads++;
  updateLoadingHud();

  gltfLoader.load(CAR_MODEL, function(gltf) {
    finishLoad(token);
    if (token !== levelToken) return;

    var model = normalizeCarModel(gltf.scene);
    group.add(model);
  }, undefined, function(error) {
    console.error('No se pudo cargar el coche de policia', error);
    finishLoad(token);
  });
}

function normalizeCarModel(model)
{
  var wrapper = new THREE.Group();
  wrapper.name = 'modelo coche';
  wrapper.add(model);

  var box = new THREE.Box3().setFromObject(wrapper);
  var size = new THREE.Vector3();
  box.getSize(size);
  if (size.x > size.z) {
    model.rotation.y = Math.PI / 2;
  }

  box.setFromObject(wrapper);
  box.getSize(size);
  var scale = CAR_LENGTH / Math.max(size.x, size.z);
  wrapper.scale.set(scale, scale, scale);

  box.setFromObject(wrapper);
  var center = new THREE.Vector3();
  box.getCenter(center);
  wrapper.position.set(-center.x, -box.min.y, -center.z);

  wrapper.traverse(function(child) {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.material.transmission) {
      child.material = new THREE.MeshPhongMaterial({
        color: 0x6f8fa8,
        specular: 0xffffff,
        shininess: 120,
        transparent: true,
        opacity: 0.5
      });
    }
  });
  return wrapper;
}

function createPlayer()
{
  var group = new THREE.Group();
  group.name = 'ladron';

  var clothMaterial = createMatteMaterial(0x141a22);
  var secondaryMaterial = createMatteMaterial(0x303947);
  var stripeMaterial = createMatteMaterial(0x8793a1);
  var skinMaterial = createMatteMaterial(0xd6a47e);
  var eyeMaterial = createShinyMaterial(0x050607, null, 80, 0xffffff);

  var torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.88, 0.42),
    clothMaterial
  );
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);

  [0.86, 1.09, 1.32].forEach(function(stripeY) {
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.715, 0.085, 0.43),
      stripeMaterial
    );
    stripe.position.set(0, stripeY, 0.005);
    stripe.castShadow = true;
    group.add(stripe);
  });

  var backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.7, 0.24),
    secondaryMaterial
  );
  backpack.position.set(0, 1.08, -0.3);
  backpack.castShadow = true;
  group.add(backpack);

  var strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.88, 0.045),
    secondaryMaterial
  );
  strap.position.set(0, 1.1, 0.235);
  strap.rotation.z = -0.38;
  group.add(strap);

  var leftArm = createThiefLimb(clothMaterial, -0.46, 1.08, -0.12);
  var rightArm = createThiefLimb(clothMaterial, 0.46, 1.08, 0.12);
  group.add(leftArm);
  group.add(rightArm);

  var leftLeg = createThiefLeg(clothMaterial, secondaryMaterial, -0.2);
  var rightLeg = createThiefLeg(clothMaterial, secondaryMaterial, 0.2);
  group.add(leftLeg);
  group.add(rightLeg);

  var head = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    clothMaterial
  );
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);

  var faceOpening = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 16, 10),
    skinMaterial
  );
  faceOpening.scale.set(1, 0.5, 0.16);
  faceOpening.position.set(0, 1.8, 0.325);
  group.add(faceOpening);

  [-0.085, 0.085].forEach(function(eyeX) {
    var eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 8, 6),
      eyeMaterial
    );
    eye.position.set(eyeX, 1.82, 0.365);
    group.add(eye);
  });

  var beanie = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.35, 0.18, 16),
    secondaryMaterial
  );
  beanie.position.y = 2.04;
  beanie.castShadow = true;
  group.add(beanie);

  var playerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({
      color: 0x55ddff,
      transparent: true,
      opacity: 0.9
    })
  );
  playerRing.position.y = 0.015;
  playerRing.rotation.x = Math.PI / 2;
  group.add(playerRing);

  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.position.copy(playerStart);
  return group;
}

function createThiefLimb(material, x, y, rotationZ)
{
  var arm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.13, 0.72, 10),
    material
  );
  arm.position.set(x, y, 0);
  arm.rotation.z = rotationZ;
  arm.castShadow = true;
  return arm;
}

function createThiefLeg(clothMaterial, shoeMaterial, x)
{
  var leg = new THREE.Group();
  leg.position.x = x;

  var trousers = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.68, 0.28),
    clothMaterial
  );
  trousers.position.y = 0.43;
  trousers.castShadow = true;
  leg.add(trousers);

  var shoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.39),
    shoeMaterial
  );
  shoe.position.set(0, 0.08, 0.06);
  shoe.castShadow = true;
  leg.add(shoe);
  return leg;
}

function loadPlayerModel()
{
  if (playerModel) {
    attachPlayerModel();
    return;
  }

  setThiefVisible(false);
  if (playerModelLoading) return;
  playerModelLoading = true;

  var token = levelToken;
  pendingLoads++;
  updateLoadingHud();

  fbxLoader.load(PLAYER_MODEL, function(object) {
    finishLoad(token);

    object.name = 'modelo jugador';
    object.scale.set(PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE);
    object.traverse(function(child) {
      if (!child.isMesh) return;
      child.castShadow = true;
      var materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(function(material) {
        material.transparent = false;
        material.opacity = 1.0;
        if (material.map) material.map.encoding = THREE.sRGBEncoding;
      });
    });

    playerModel = { object: object, mixer: null, walkAction: null, idleAction: null };

    var walkClip = null;
    for (var i = 0; i < object.animations.length; i++) {
      if (object.animations[i].tracks.length > 0) {
        walkClip = object.animations[i];
        break;
      }
    }
    if (walkClip) {
      playerModel.mixer = new THREE.AnimationMixer(object);
      playerModel.walkAction = playerModel.mixer.clipAction(walkClip);
      playerModel.walkAction.timeScale = PLAYER_ANIMATION_SPEED;
      playerModel.walkAction.play();
      playerModel.walkAction.paused = true;
      playerModel.mixer.update(0);
      loadPlayerIdle();
    }

    attachPlayerModel();
  }, undefined, function(error) {
    console.error('No se pudo cargar el modelo del jugador; se usa el ladron de primitivas', error);
    finishLoad(token);
    setThiefVisible(true);
  });
}

function attachPlayerModel()
{
  var oldParts = player.children.filter(function(child) {
    return child.geometry === undefined || child.geometry.type !== 'TorusGeometry';
  });
  oldParts.forEach(function(child) { player.remove(child); });
  player.userData.leftArm = null;
  player.userData.rightArm = null;
  player.userData.leftLeg = null;
  player.userData.rightLeg = null;

  player.add(playerModel.object);
  player.userData.walkAction = playerModel.walkAction;
  player.userData.idleAction = playerModel.idleAction;
  player.userData.moving = null;
  if (playerModel.mixer) mixers.push(playerModel.mixer);
  setPlayerAnimation(false);
}

function setThiefVisible(visible)
{
  player.children.forEach(function(child) {
    if (child.geometry === undefined || child.geometry.type !== 'TorusGeometry') {
      child.visible = visible;
    }
  });
}

function loadPlayerIdle()
{
  fbxLoader.load(PLAYER_IDLE_ANIMATION, function(animData) {
    playerModel.idleAction = playerModel.mixer.clipAction(animData.animations[0]);
    player.userData.idleAction = playerModel.idleAction;
    player.userData.moving = null;
    setPlayerAnimation(false);
  }, undefined, function() {
    console.log('Sin animacion de reposo: el jugador se queda quieto en la pose de andar');
  });
}

function setPlayerAnimation(moving)
{
  var walk = player.userData.walkAction;
  var idle = player.userData.idleAction;
  if (!walk) return;

  if (!idle) {
    walk.paused = !moving;
    return;
  }

  if (player.userData.moving === moving) return;
  player.userData.moving = moving;

  if (moving) {
    idle.stop();
    walk.paused = false;
    walk.play();
  } else {
    walk.stop();
    idle.play();
  }
}

function createPlayerMarker()
{
  var group = new THREE.Group();
  group.name = 'marcador del jugador';

  var arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.7, 1.6, 3),
    new THREE.MeshBasicMaterial({ color: 0xffe14d })
  );
  arrow.rotation.x = Math.PI / 2;
  group.add(arrow);

  group.position.y = 3.2;
  group.visible = false;
  return group;
}

function createExit()
{
  var group = new THREE.Group();
  group.name = 'salida';
  group.position.copy(exitPosition);

  var exitMaterial = createGlowMaterial(0x35e36f);

  var pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.35, 0.12, 32),
    exitMaterial
  );
  pad.position.y = 0.06;
  pad.receiveShadow = true;
  group.add(pad);

  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.36, 0.09, 10, 32),
    exitMaterial
  );
  ring.position.y = 0.14;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  var beacon = new THREE.PointLight(0x42ff80, 0.75, 6, 2);
  beacon.position.y = 1.2;
  group.add(beacon);

  return group;
}

function loadSharedModel(url, onLoad)
{
  var entry = modelCache[url];
  if (entry && entry.scene) {
    onLoad(entry.scene.clone());
    return;
  }
  if (entry) {
    entry.callbacks.push(onLoad);
    return;
  }

  entry = { scene: null, callbacks: [onLoad] };
  modelCache[url] = entry;
  var token = levelToken;
  pendingLoads++;
  updateLoadingHud();

  gltfLoader.load(url, function(gltf) {
    finishLoad(token);
    entry.scene = gltf.scene;
    entry.scene.traverse(function(child) {
      if (child.isMesh) child.material = toPhongMaterial(child.material);
    });
    entry.callbacks.forEach(function(callback) {
      callback(entry.scene.clone());
    });
    entry.callbacks = [];
  }, undefined, function(error) {
    console.error('No se pudo cargar ' + url, error);
    finishLoad(token);
  });
}

function toPhongMaterial(material)
{
  var phong = new THREE.MeshPhongMaterial({
    color: material.color,
    map: material.map,
    specular: 0x888888,
    shininess: 60,
    transparent: material.transparent,
    opacity: material.opacity
  });
  phong.name = material.name;
  return phong;
}

function createSecurityCamera(
  x, z, baseAngle, sweep, phase, customRange, customAngle
)
{
  var group = new THREE.Group();
  group.name = 'camara de seguridad';
  group.position.set(x, 0, z);
  group.rotation.y = baseAngle;

  var metalMaterial = createShinyMaterial(
    0xb7c1cc,
    loadTexture('images/metal_128.jpg', 1, 1),
    110,
    0xffffff
  );

  if (currentLevel === 2) {
    createCameraColumn(group, x, z, baseAngle);
  }

  var mount = new THREE.Group();
  mount.name = 'soporte';
  group.add(mount);

  var pivot = new THREE.Group();
  pivot.position.set(0, CAMERA_HEIGHT, CAMERA_ARM_LENGTH);
  group.add(pivot);

  var head = new THREE.Group();
  head.name = 'cabezal';
  pivot.add(head);

  var arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, CAMERA_ARM_LENGTH),
    metalMaterial
  );
  arm.position.set(0, CAMERA_HEIGHT, CAMERA_ARM_LENGTH / 2);
  mount.add(arm);

  var housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.35, 0.8),
    metalMaterial
  );
  housing.position.set(0, 0.2, 0.3);
  housing.castShadow = true;
  head.add(housing);

  var lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.12, 16),
    createShinyMaterial(0x222833, null, 150, 0xffffff)
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 0.2, 0.74);
  head.add(lens);

  loadSharedModel(CAMERA_MODEL, function(model) {
    mount.clear();
    head.clear();
    attachCameraModel(model, mount, head);
  });

  var range = (customRange || 10.5) * VISION_RANGE_FACTOR;
  var halfAngle = THREE.MathUtils.degToRad(customAngle || 29);
  var field = createVisionField(range, halfAngle, 0xf7c94c, 0.24);
  field.position.y = -CAMERA_HEIGHT + 0.04;
  pivot.add(field);

  var spot = new THREE.SpotLight(0xffd86a, 1.25, range, halfAngle, 0.35, 1.6);
  spot.position.set(0, 0.2, 0.6);
  spot.castShadow = false;
  pivot.add(spot);

  var target = new THREE.Object3D();
  target.position.set(0, -CAMERA_HEIGHT + 0.3, range);
  pivot.add(target);
  spot.target = target;

  scene.add(group);
  securityCameras.push({
    group: group,
    pivot: pivot,
    field: field,
    sweep: sweep,
    phase: phase,
    speed: 0.72 * ENEMY_SPEED_FACTOR,
    range: range,
    halfAngle: halfAngle
  });
}

function attachCameraModel(model, mount, head)
{
  var scale = 0.09;
  var axis = new THREE.Vector3(0, 4.7, -1.0);
  var wallZ = -8.4;

  var armCopy = model;
  var headCopy = model.clone();
  splitCameraModel(armCopy, true);
  splitCameraModel(headCopy, false);

  armCopy.scale.set(scale, scale, scale);
  armCopy.position.set(0, CAMERA_HEIGHT - axis.y * scale, -wallZ * scale);
  mount.add(armCopy);

  var headTurn = new THREE.Group();
  headTurn.rotation.y = -Math.PI / 2;
  headCopy.scale.set(scale, scale, scale);
  headCopy.position.set(-axis.x * scale, -axis.y * scale, -axis.z * scale);
  headTurn.add(headCopy);
  head.add(headTurn);

  [armCopy, headCopy].forEach(function(copy) {
    copy.traverse(function(child) {
      if (child.isMesh) child.castShadow = true;
    });
  });
}

function splitCameraModel(model, keepArm)
{
  model.updateMatrixWorld(true);
  model.traverse(function(child) {
    if (!child.isMesh) return;
    var center = new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3());
    var isArm = center.z < -2 && center.y < 5;
    child.visible = isArm === keepArm;
  });
}

function createCameraColumn(group, x, z, angle)
{
  var size = 0.5;
  var column = new THREE.Mesh(
    new THREE.BoxGeometry(size, CAMERA_HEIGHT + 0.6, size),
    createMatteMaterial(0x9a9a92, loadTexture('images/metal_128.jpg', 1, 4))
  );
  column.name = 'pilar';
  column.position.set(0, (CAMERA_HEIGHT + 0.6) / 2, -size / 2);
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);
  occluders.push(column);

  var centerX = x - Math.sin(angle) * size / 2;
  var centerZ = z - Math.cos(angle) * size / 2;
  colliders.push({
    minX: centerX - size / 2,
    maxX: centerX + size / 2,
    minZ: centerZ - size / 2,
    maxZ: centerZ + size / 2
  });
}

function createGuard(routeCoordinates, phase, options)
{
  options = options || {};
  var route = routeCoordinates.map(function(point) {
    return new THREE.Vector3(point[0], 0.03, point[1]);
  });

  var group = new THREE.Group();
  group.name = 'guardia';
  group.position.copy(route[0]);

  var range = (options.range || 8) * VISION_RANGE_FACTOR;
  var halfAngle = THREE.MathUtils.degToRad(options.angle || 36);
  var field = createVisionField(range, halfAngle, 0xff8738, 0.2);
  field.position.y = 0.025;
  group.add(field);

  scene.add(group);

  var guard = {
    group: group,
    route: route,
    routeIndex: 1,
    speed: (options.speed || 1.65) * ENEMY_SPEED_FACTOR,
    range: range,
    halfAngle: halfAngle,
    field: field,
    phase: phase,
    mixer: null,
    action: null,
    leftLeg: null,
    rightLeg: null
  };
  guards.push(guard);
  loadGuardModel(guard);
}

function loadGuardModel(guard)
{
  var token = levelToken;
  pendingLoads++;
  updateLoadingHud();

  fbxLoader.load(GUARD_MODEL, function(object) {
    finishLoad(token);
    if (token !== levelToken) return;

    object.name = 'modelo guardia';
    object.scale.set(GUARD_MODEL_SCALE, GUARD_MODEL_SCALE, GUARD_MODEL_SCALE);
    object.traverse(function(child) {
      if (!child.isMesh) return;
      child.castShadow = true;
      var materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach(function(material) {
        material.transparent = false;
        material.opacity = 1.0;
        if (material.map) material.map.encoding = THREE.sRGBEncoding;
      });
    });
    guard.group.add(object);

    var walkClip = null;
    for (var i = 0; i < object.animations.length; i++) {
      if (object.animations[i].tracks.length > 0) {
        walkClip = object.animations[i];
        break;
      }
    }
    if (walkClip) {
      guard.mixer = new THREE.AnimationMixer(object);
      guard.action = guard.mixer.clipAction(walkClip);
      guard.action.timeScale = guard.speed / GUARD_WALK_SPEED;
      guard.action.play();
      guard.mixer.update(0);
      mixers.push(guard.mixer);
    }
  }, undefined, function(error) {
    console.error('No se pudo cargar el guardia FBX; se usa el guardia de primitivas', error);
    finishLoad(token);
    if (token !== levelToken) return;
    createGuardFallback(guard);
  });
}

function createGuardFallback(guard)
{
  var group = guard.group;
  var uniformMaterial = createMatteMaterial(0x243a52);
  var vestMaterial = createMatteMaterial(0x172433);
  var skinMaterial = createMatteMaterial(0xd6a77c);
  var badgeMaterial = createShinyMaterial(0xffd269, null, 120, 0xffffff);

  var torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.05, 0.42),
    uniformMaterial
  );
  torso.position.y = 1.22;
  torso.castShadow = true;
  group.add(torso);

  var vest = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.7, 0.13),
    vestMaterial
  );
  vest.position.set(0, 1.25, 0.26);
  vest.castShadow = true;
  group.add(vest);

  var belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.77, 0.12, 0.49),
    vestMaterial
  );
  belt.position.y = 0.83;
  belt.castShadow = true;
  group.add(belt);

  var badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.15, 0.035),
    badgeMaterial
  );
  badge.position.set(0.18, 1.43, 0.345);
  group.add(badge);

  [-0.48, 0.48].forEach(function(armX) {
    var arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.12, 0.78, 10),
      uniformMaterial
    );
    arm.position.set(armX, 1.17, 0);
    arm.rotation.z = armX < 0 ? -0.1 : 0.1;
    arm.castShadow = true;
    group.add(arm);
  });

  var head = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 14, 10),
    skinMaterial
  );
  head.position.set(0, 1.98, 0.02);
  head.castShadow = true;
  group.add(head);

  var cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.15, 16),
    uniformMaterial
  );
  cap.position.y = 2.2;
  cap.castShadow = true;
  group.add(cap);

  var capVisor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.06, 0.3),
    vestMaterial
  );
  capVisor.position.set(0, 2.15, 0.18);
  capVisor.castShadow = true;
  group.add(capVisor);

  guard.leftLeg = createGuardLeg(uniformMaterial, -0.2);
  guard.rightLeg = createGuardLeg(uniformMaterial, 0.2);
  group.add(guard.leftLeg);
  group.add(guard.rightLeg);
}

function createGuardLeg(material, x)
{
  var leg = new THREE.Group();
  leg.position.set(x, 0.82, 0);

  var trousers = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.7, 0.25),
    material
  );
  trousers.position.y = -0.35;
  trousers.castShadow = true;
  leg.add(trousers);

  var boot = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.2, 0.36),
    createMatteMaterial(0x10161d)
  );
  boot.position.set(0, -0.75, 0.055);
  boot.castShadow = true;
  leg.add(boot);
  return leg;
}

function createVisionField(range, halfAngle, color, opacity)
{
  var segments = 24;
  var vertices = new Float32Array((segments + 2) * 3);

  for (var i = 0; i <= segments; i++) {
    var angle = -halfAngle + (2 * halfAngle * i) / segments;
    var base = (i + 1) * 3;
    vertices[base] = Math.sin(angle) * range;
    vertices[base + 1] = 0;
    vertices[base + 2] = Math.cos(angle) * range;
  }

  var indices = [];
  for (var j = 1; j <= segments; j++) {
    indices.push(0, j, j + 1);
  }

  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  var material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  var field = new THREE.Mesh(geometry, material);
  field.name = 'campo de vision';
  field.renderOrder = 1;
  field.userData.originalColor = color;
  field.userData.originalOpacity = opacity;
  return field;
}

function onKeyDown(event)
{
  if (event.target.tagName === 'INPUT') return;

  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      controls.moveForward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      controls.moveBackward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      controls.moveLeft = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      controls.moveRight = true;
      break;
    case 'KeyF':
      if (gameState === 'playing' || gameState === 'intro') toggleCameraMode();
      break;
    case 'KeyR':
      if (!event.repeat) restartGame();
      break;
  }
}

function restartGame()
{
  loadLevel(0);
}

function startFromForm(event)
{
  event.preventDefault();
  var input = document.getElementById('player-name');
  var name = cleanPlayerName(input.value);
  if (name === '') {
    input.focus();
    return;
  }
  playerName = name;
  input.value = name;
  savePlayerName(name);
  input.blur();
  requestMouseControl();
}

function onKeyUp(event)
{
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      controls.moveForward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      controls.moveBackward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      controls.moveLeft = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      controls.moveRight = false;
      break;
  }
}

function clearControls()
{
  controls.moveForward = false;
  controls.moveBackward = false;
  controls.moveLeft = false;
  controls.moveRight = false;
}

function toggleCameraMode()
{
  firstPerson = !firstPerson;
  player.visible = !firstPerson;
}

function requestMouseControl()
{
  var canPlay = gameState === 'playing' || gameState === 'intro';
  if (canPlay && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
}

function onPointerLockChange()
{
  var mouseCaptured = document.pointerLockElement === renderer.domElement;
  document.getElementById('mouse-status').textContent = mouseCaptured
    ? 'Ratón activo · Esc: pausar'
    : 'Haz clic en el escenario para jugar';

  if (mouseCaptured) {
    document.getElementById('start-screen').classList.remove('visible');
  }

  if (!mouseCaptured) clearControls();
}

function onMouseMove(event)
{
  if (
    gameState !== 'playing' ||
    document.pointerLockElement !== renderer.domElement
  ) return;

  viewYaw -= event.movementX * MOUSE_SENSITIVITY;
  viewPitch -= event.movementY * MOUSE_SENSITIVITY;
  viewPitch = THREE.MathUtils.clamp(
    viewPitch,
    -Math.PI / 2 + 0.12,
    Math.PI / 2 - 0.12
  );
}

function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update(delta, time)
{
  TWEEN.update(time);

  var mouseCaptured = document.pointerLockElement === renderer.domElement;

  if (gameState === 'playing' && mouseCaptured) {
    gameTime += delta;
    levelTime += delta;
    updatePlayer(delta);
    updateSecurityCameras();
    updateGuards(delta);
    updatePoliceCars(delta);
    updateMixers(delta);

    scene.updateMatrixWorld(true);
    checkEnemyVision(delta);

    if (gameState === 'playing') {
      checkExit();
    }
  }

  if (gameState === 'intro') updateMixers(delta);

  updateBeacons();
  updateExitAnimation();
  updateCamera();
  updateTimerHud();
  stats.update();
}

function updatePlayer(delta)
{
  var direction = new THREE.Vector3();
  var forward = new THREE.Vector3(
    -Math.sin(viewYaw),
    0,
    -Math.cos(viewYaw)
  );
  var right = new THREE.Vector3(
    Math.cos(viewYaw),
    0,
    -Math.sin(viewYaw)
  );

  if (controls.moveForward) direction.add(forward);
  if (controls.moveBackward) direction.sub(forward);
  if (controls.moveLeft) direction.sub(right);
  if (controls.moveRight) direction.add(right);

  player.rotation.y = viewYaw + Math.PI;

  var moving = direction.lengthSq() > 0;
  setPlayerAnimation(moving);

  if (!moving) {
    setThiefPose(0);
    return;
  }

  direction.normalize();
  var movement = direction.multiplyScalar(PLAYER_SPEED * delta);

  var nextX = player.position.x + movement.x;
  if (isPositionFree(nextX, player.position.z, PLAYER_RADIUS)) {
    player.position.x = nextX;
  }

  var nextZ = player.position.z + movement.z;
  if (isPositionFree(player.position.x, nextZ, PLAYER_RADIUS)) {
    player.position.z = nextZ;
  }

  setThiefPose(Math.sin(gameTime * 10) * 0.42);
}

function setThiefPose(walk)
{
  if (!player.userData.leftArm) return;
  player.userData.leftArm.rotation.x = walk;
  player.userData.rightArm.rotation.x = -walk;
  player.userData.leftLeg.rotation.x = -walk;
  player.userData.rightLeg.rotation.x = walk;
}

function isPositionFree(x, z, radius)
{
  for (var i = 0; i < colliders.length; i++) {
    var box = colliders[i];
    var nearestX = THREE.MathUtils.clamp(x, box.minX, box.maxX);
    var nearestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ);
    var differenceX = x - nearestX;
    var differenceZ = z - nearestZ;

    if (differenceX * differenceX + differenceZ * differenceZ < radius * radius) {
      return false;
    }
  }
  return true;
}

function updateSecurityCameras()
{
  securityCameras.forEach(function(securityCamera) {
    var oscillation = Math.sin(gameTime * securityCamera.speed + securityCamera.phase);
    securityCamera.pivot.rotation.y = oscillation * securityCamera.sweep;
  });
}

function followRoute(mover, delta, radius)
{
  var target = mover.route[mover.routeIndex];
  var direction = target.clone().sub(mover.group.position);
  direction.y = 0;
  var distance = direction.length();

  if (distance < 0.08) {
    mover.routeIndex = (mover.routeIndex + 1) % mover.route.length;
    return null;
  }

  direction.normalize();
  var step = Math.min(mover.speed * delta, distance);
  var nextPosition = mover.group.position.clone().add(
    direction.clone().multiplyScalar(step)
  );

  if (isPositionFree(nextPosition.x, nextPosition.z, radius)) {
    mover.group.position.copy(nextPosition);
  } else {
    mover.routeIndex = (mover.routeIndex + 1) % mover.route.length;
  }

  mover.group.rotation.y = Math.atan2(direction.x, direction.z);
  return direction;
}

function updateGuards(delta)
{
  guards.forEach(function(guard) {
    followRoute(guard, delta, 0.42);

    if (guard.leftLeg) {
      var walk = Math.sin(gameTime * 8 + guard.phase) * 0.38;
      guard.leftLeg.rotation.x = walk;
      guard.rightLeg.rotation.x = -walk;
    }
  });
}

function updatePoliceCars(delta)
{
  policeCars.forEach(function(car) {
    if (!car.route) return;
    followRoute(car, delta, 0.6);

    var local = car.group.worldToLocal(player.position.clone());
    if (Math.abs(local.x) < 1.3 && Math.abs(local.z) < CAR_LENGTH / 2 + 0.4) {
      finishGame(false, car.field, '¡El coche patrulla te ha alcanzado!');
    }
  });
}

function updateMixers(delta)
{
  mixers.forEach(function(mixer) {
    mixer.update(delta);
  });
}

function updateBeacons()
{
  var red = Math.floor(clock.elapsedTime * 4) % 2 === 0;
  policeCars.forEach(function(car) {
    car.beacon.color.set(red ? 0xff2a2a : 0x2a5bff);
    car.beacon.position.x = red ? 0.45 : -0.45;
  });
}

function checkEnemyVision(delta)
{
  var origin = new THREE.Vector3();
  var forward = new THREE.Vector3();
  var worldQuaternion = new THREE.Quaternion();
  var watchers = [];
  var message = null;

  securityCameras.forEach(function(securityCamera) {
    securityCamera.pivot.getWorldPosition(origin);
    securityCamera.pivot.getWorldQuaternion(worldQuaternion);
    forward.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
    if (canSeePlayer(origin, forward, securityCamera.range, securityCamera.halfAngle)) {
      watchers.push(securityCamera.field);
    }
  });

  guards.forEach(function(guard) {
    guard.group.getWorldPosition(origin);
    origin.y += 1.6;
    guard.group.getWorldQuaternion(worldQuaternion);
    forward.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
    if (canSeePlayer(origin, forward, guard.range, guard.halfAngle)) {
      watchers.push(guard.field);
    }
  });

  policeCars.forEach(function(car) {
    if (!car.route) return;
    car.group.getWorldQuaternion(worldQuaternion);
    forward.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
    car.group.getWorldPosition(origin);
    origin.addScaledVector(forward, CAR_LENGTH / 2);
    origin.y += 0.9;
    if (canSeePlayer(origin, forward, car.range, car.halfAngle)) {
      watchers.push(car.field);
      message = 'Los faros del coche patrulla te han iluminado.';
    }
  });

  updateAlert(delta, watchers, message);
}

function updateAlert(delta, watchers, message)
{
  if (watchers.length > 0) {
    alertLevel = Math.min(1, alertLevel + delta / ALERT_FILL_TIME);
  } else {
    alertLevel = Math.max(0, alertLevel - delta / ALERT_EMPTY_TIME);
  }

  getAllVisionFields().forEach(function(field) {
    var watching = watchers.indexOf(field) >= 0;
    var amount = watching ? alertLevel : 0;
    field.material.color.set(field.userData.originalColor).lerp(ALERT_COLOR, amount);
    field.material.opacity = field.userData.originalOpacity + amount * 0.25;
  });

  updateAlertHud();

  if (alertLevel >= 1) {
    finishGame(false, watchers[0], message);
  }
}

function getAllVisionFields()
{
  var fields = [];
  securityCameras.forEach(function(securityCamera) { fields.push(securityCamera.field); });
  guards.forEach(function(guard) { fields.push(guard.field); });
  policeCars.forEach(function(car) {
    if (car.field) fields.push(car.field);
  });
  return fields;
}

function updateAlertHud()
{
  var alertBox = document.getElementById('alert');
  var fill = document.getElementById('alert-fill');
  if (alertLevel > 0) {
    alertBox.classList.add('visible');
  } else {
    alertBox.classList.remove('visible');
  }
  fill.style.width = Math.round(alertLevel * 100) + '%';
  fill.style.background = 'hsl(' + Math.round(45 - 45 * alertLevel) + ', 100%, 55%)';
}

function canSeePlayer(origin, forward, range, halfAngle)
{
  var playerTarget = new THREE.Vector3(
    player.position.x,
    player.position.y + 1.0,
    player.position.z
  );

  var horizontalDirection = new THREE.Vector3(
    playerTarget.x - origin.x,
    0,
    playerTarget.z - origin.z
  );
  var horizontalDistance = horizontalDirection.length();

  if (horizontalDistance > range || horizontalDistance === 0) return false;

  horizontalDirection.normalize();
  var horizontalForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

  if (horizontalForward.dot(horizontalDirection) < Math.cos(halfAngle)) {
    return false;
  }

  var rayDirection = playerTarget.clone().sub(origin);
  var playerDistance = rayDirection.length();
  rayDirection.normalize();
  visionRaycaster.set(origin, rayDirection);
  visionRaycaster.near = 0.05;
  visionRaycaster.far = Math.max(0.05, playerDistance - PLAYER_RADIUS);

  var intersections = visionRaycaster.intersectObjects(occluders, false);
  return intersections.length === 0;
}

function checkExit()
{
  var distanceToExit = Math.hypot(
    player.position.x - exitPosition.x,
    player.position.z - exitPosition.z
  );

  if (distanceToExit < 1.15) {
    finishGame(true, null, null);
  }
}

function updateExitAnimation()
{
  if (!exitZone) return;
  var pulse = 1 + Math.sin(clock.elapsedTime * 3.4) * 0.08;
  exitZone.children[1].scale.set(pulse, pulse, pulse);
  exitZone.rotation.y = clock.elapsedTime * 0.22;
}

function updateCamera()
{
  var forward = new THREE.Vector3(-Math.sin(viewYaw), 0, -Math.cos(viewYaw));
  var eye = new THREE.Vector3(
    player.position.x,
    player.position.y + PLAYER_EYE_HEIGHT,
    player.position.z
  );

  playerMarker.position.set(player.position.x, 3.2, player.position.z);
  playerMarker.rotation.y = viewYaw + Math.PI;

  var goal = firstPerson ? eye : thirdPersonPosition(forward);

  if (gameState === 'intro') {
    var overview = new THREE.Vector3(
      player.position.x - forward.x * 7,
      player.position.y + 13,
      player.position.z - forward.z * 7
    );
    camera.position.lerpVectors(overview, goal, introAnimation.progress);
    camera.lookAt(
      eye.x + forward.x * 3,
      eye.y - 0.4,
      eye.z + forward.z * 3
    );
    return;
  }

  if (firstPerson) {
    var lookDirection = new THREE.Vector3(
      forward.x * Math.cos(viewPitch),
      Math.sin(viewPitch),
      forward.z * Math.cos(viewPitch)
    );
    camera.position.copy(eye);
    camera.lookAt(new THREE.Vector3().addVectors(eye, lookDirection));
  } else {
    camera.position.copy(goal);
    camera.lookAt(
      player.position.x + forward.x * 1.5,
      player.position.y + 1.5,
      player.position.z + forward.z * 1.5
    );
  }
}

function thirdPersonPosition(forward)
{
  var back = THIRD_PERSON_DISTANCE * Math.cos(viewPitch);
  var up = THIRD_PERSON_HEIGHT - THIRD_PERSON_DISTANCE * Math.sin(viewPitch);
  var desired = new THREE.Vector3(
    player.position.x - forward.x * back,
    Math.max(player.position.y + 0.4, player.position.y + up),
    player.position.z - forward.z * back
  );
  if (currentLevel < 2) desired.y = Math.min(desired.y, 3.7);

  var head = new THREE.Vector3(
    player.position.x,
    player.position.y + 1.5,
    player.position.z
  );
  var direction = desired.clone().sub(head);
  var distance = direction.length();
  direction.normalize();
  cameraRaycaster.set(head, direction);
  cameraRaycaster.far = distance;
  var intersections = cameraRaycaster.intersectObjects(occluders, false);
  if (intersections.length > 0) {
    var safeDistance = Math.max(0.3, intersections[0].distance - 0.3);
    return head.addScaledVector(direction, safeDistance);
  }
  return desired;
}

function finishGame(playerWon, detectedField, customMessage)
{
  if (gameState !== 'playing') return;
  clearControls();

  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }

  if (detectedField) {
    detectedField.material.color.set(0xff2738);
    detectedField.material.opacity = 0.42;
  }

  var title = document.getElementById('result-title');
  var message = document.getElementById('result-message');
  var button = document.getElementById('restart-button');
  document.getElementById('result-ranking').textContent = '';

  if (playerWon) levelTimes[currentLevel] = levelTime;

  if (playerWon && currentLevel < levelNames.length - 1) {
    gameState = 'levelComplete';
    title.textContent = '¡Nivel completado!';
    message.textContent = 'Has escapado ' + levelEscapes[currentLevel] +
      ' en ' + formatTime(levelTime) + '. Total: ' + formatTime(getTotalTime()) + '.';
    title.style.color = '#79f2a0';
    button.textContent = 'Siguiente nivel';
  } else if (playerWon) {
    gameState = 'won';
    title.textContent = '¡Biggie es libre!';
    message.textContent = 'Has escapado de la UPV sin que nadie te vea. ' + getTimesSummary();
    title.style.color = '#79f2a0';
    button.textContent = 'Jugar de nuevo';
    sendScoreToRanking();
  } else {
    gameState = 'lost';
    title.textContent = '¡Te han descubierto!';
    message.textContent = customMessage ||
      (levelHints[currentLevel] + '. Evita los campos de visión.');
    title.style.color = '#ff6b72';
    button.textContent = 'Reiniciar nivel';
  }

  document.getElementById('result').classList.add('visible');
}

function sendScoreToRanking()
{
  var text = document.getElementById('result-ranking');
  for (var i = 0; i < levelNames.length; i++) {
    if (levelTimes[i] === undefined) return;
  }
  if (!rankingConfigured() || playerName === '') return;

  var total = Math.round(getTotalTime() * 100) / 100;
  text.textContent = 'Guardando tu tiempo en el ranking…';
  submitScore(playerName, total).then(function(position) {
    text.textContent = position
      ? playerName + ', has quedado en el puesto ' + position + ' del ranking global.'
      : 'Tiempo guardado en el ranking global.';
    showRanking();
  }).catch(function(error) {
    console.error('No se pudo guardar el tiempo', error);
    text.textContent = 'No se pudo guardar el tiempo en el ranking.';
  });
}

function handleResultAction()
{
  if (gameState === 'levelComplete') {
    loadLevel(currentLevel + 1);
  } else if (gameState === 'won') {
    loadLevel(0);
  } else {
    resetGame();
  }
}

function formatTime(seconds)
{
  var minutes = Math.floor(seconds / 60);
  var rest = seconds - minutes * 60;
  var text = rest.toFixed(1);
  if (rest < 10) text = '0' + text;
  return minutes + ':' + text;
}

function getTotalTime()
{
  var total = 0;
  for (var i = 0; i < levelTimes.length; i++) {
    if (levelTimes[i] !== undefined && i !== currentLevel) total += levelTimes[i];
  }
  return total + levelTime;
}

function getTimesSummary()
{
  var parts = [];
  for (var i = 0; i < levelNames.length; i++) {
    if (levelTimes[i] !== undefined) {
      parts.push('Nivel ' + (i + 1) + ': ' + formatTime(levelTimes[i]));
    }
  }
  return parts.join(' · ') + ' · Total: ' + formatTime(getTotalTime());
}

function updateTimerHud()
{
  document.getElementById('time-level').textContent = formatTime(levelTime);
  document.getElementById('time-total').textContent = formatTime(getTotalTime());
}

function updateLevelHud()
{
  document.getElementById('level-number').textContent =
    (currentLevel + 1) + '/' + levelNames.length;
  document.getElementById('level-name').textContent = levelNames[currentLevel];
  document.getElementById('level-hint').textContent = levelHints[currentLevel];
}

function updateLoadingHud()
{
  document.getElementById('loading-status').textContent =
    pendingLoads > 0 ? 'Cargando modelos 3D…' : '';
}

function finishLoad(token)
{
  if (token !== levelToken) return;
  pendingLoads = Math.max(0, pendingLoads - 1);
  updateLoadingHud();
}

function resetGame()
{
  gameTime = 0;
  clearControls();
  player.position.copy(playerStart);
  viewYaw = 0;
  viewPitch = -0.06;
  player.rotation.y = viewYaw + Math.PI;
  player.visible = !firstPerson;
  setThiefPose(0);

  securityCameras.forEach(function(securityCamera) {
    securityCamera.pivot.rotation.y = 0;
    restoreVisionField(securityCamera.field);
  });

  guards.forEach(function(guard) {
    guard.group.position.copy(guard.route[0]);
    guard.routeIndex = 1;
    var firstDirection = guard.route[1].clone().sub(guard.route[0]);
    guard.group.rotation.y = Math.atan2(firstDirection.x, firstDirection.z);
    if (guard.leftLeg) {
      guard.leftLeg.rotation.x = 0;
      guard.rightLeg.rotation.x = 0;
    }
    restoreVisionField(guard.field);
  });

  policeCars.forEach(function(car) {
    if (!car.route) return;
    car.group.position.copy(car.route[0]);
    car.routeIndex = 1;
    var carDirection = car.route[1].clone().sub(car.route[0]);
    car.group.rotation.y = Math.atan2(carDirection.x, carDirection.z);
    restoreVisionField(car.field);
  });

  document.getElementById('mouse-status').textContent =
    'Haz clic en el escenario para jugar';
  document.getElementById('restart-button').textContent = 'Reiniciar nivel';
  document.getElementById('result').classList.remove('visible');
  alertLevel = 0;
  updateAlertHud();

  startIntro();
  updateCamera();
}

function startIntro()
{
  gameState = 'intro';
  introAnimation.progress = 0;
  TWEEN.removeAll();
  new TWEEN.Tween(introAnimation)
    .to({ progress: 1 }, 1600)
    .easing(TWEEN.Easing.Quadratic.InOut)
    .onComplete(function() {
      gameState = 'playing';
    })
    .start();
}

function restoreVisionField(field)
{
  field.material.color.set(field.userData.originalColor);
  field.material.opacity = field.userData.originalOpacity;
}

function render(time)
{
  requestAnimationFrame(render);
  var delta = Math.min(clock.getDelta(), 0.05);
  update(delta, time);

  var width = window.innerWidth;
  var height = window.innerHeight;
  var miniSize = Math.floor(Math.min(width, height) / 4);

  renderer.shadowMap.needsUpdate = true;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, width, height);
  renderer.clear();
  renderer.render(scene, camera);

  playerMarker.visible = true;
  cenital.position.set(player.position.x, 40, player.position.z);
  cenital.lookAt(player.position.x, 0, player.position.z);
  renderer.setViewport(0, 0, miniSize, miniSize);
  renderer.setScissor(0, 0, miniSize, miniSize);
  renderer.setScissorTest(true);
  renderer.clear();
  renderer.render(scene, cenital);
  renderer.setScissorTest(false);
  playerMarker.visible = false;
}
