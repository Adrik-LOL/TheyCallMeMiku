import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

const scene = new THREE.Scene();
scene.background = null;
const sceneFadeDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 400;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(3, 6, 8);
scene.add(keyLight);

let modelSize = null;
let vrm = null;
let mixer = null;
let performanceStage = null;
let modelBasePosition = null;
let performanceStageTop = null;
let performanceFootBones = [];
let performanceFootOffset = 0;
const footWorldPosition = new THREE.Vector3();
let idleAction = null;
let talkingAction = null;
let danceAction = null;
let currentAction = null;
let isMikuSpeaking = false;
let previousFrameTime = performance.now();
const conversationHistory = [];
let speechAudioContext = null;
let isActionInProgress = false;
let activeActionController = null;
let currentSpeechSource = null;
let currentSpeechSourceStarted = false;
let sceneTransitionVersion = 0;
const songAnimationActions = new Map();
let animationLoader;

const chat = document.getElementById('chat');
const sceneTransition = document.getElementById('scene-transition');
const chatForm = document.getElementById('chat-form');
const questionInput = document.getElementById('question');
const messages = document.getElementById('messages');
const sendButton = document.getElementById('send');
const chatToggle = document.getElementById('chat-toggle');
const modeButtons = document.querySelectorAll('.mode-button');

function setActiveMode(mode) {
  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  const isTextMode = mode === 'text';
  chatForm.style.display = isTextMode ? 'flex' : 'none';
  messages.style.display = isTextMode ? 'block' : 'none';

  if (isTextMode && window.innerWidth <= 700) {
    chat.classList.add('is-open');
  } else {
    chat.classList.remove('is-open');
  }
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveMode(button.dataset.mode));
});

function updateChatMode() {
  if (window.innerWidth > 700) {
    chat.classList.remove('is-open');
  }
}

chatToggle.addEventListener('click', () => {
  if (window.innerWidth <= 700) {
    chat.classList.toggle('is-open');
  }
});

window.addEventListener('resize', updateChatMode);
setActiveMode('text');
updateChatMode();

function fitCameraToModel() {
  if (!modelSize) return;

  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const radius = modelSize.length() / 2;
  const distance = (radius / Math.sin(limitingFov / 2)) * 1.1;

  camera.position.set(0, 0, distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = distance * 10;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function parseBinaryAsset(loader, url) {
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Asset request failed (${response.status}): ${url}`);
      }
      return response.arrayBuffer();
    })
    .then((data) => new Promise((resolve, reject) => {
      loader.parse(data, '/miku/', resolve, reject);
    }));
}

async function loadModelAndIdle() {
  const modelLoader = new GLTFLoader();
  modelLoader.register((parser) => new VRMLoaderPlugin(parser));

  const modelGltf = await parseBinaryAsset(modelLoader, '/miku/Miku4.vrm');
  vrm = modelGltf.userData.vrm;

  if (!vrm) {
    throw new Error('Miku4.vrm did not contain a VRM avatar.');
  }

  VRMUtils.rotateVRM0(vrm);

  const bounds = new THREE.Box3().setFromObject(vrm.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  modelSize = bounds.getSize(new THREE.Vector3());

  vrm.scene.position.sub(center);
  vrm.scene.position.z += 0.5;
  vrm.scene.position.y -= 0.2;
  modelBasePosition = vrm.scene.position.clone();
  scene.add(vrm.scene);
  fitCameraToModel();
  createPerformanceStage();

  animationLoader = new GLTFLoader();
  animationLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));

  const [idleGltf, talkingGltf] = await Promise.all([
    parseBinaryAsset(animationLoader, '/miku/idle.vrma'),
    parseBinaryAsset(animationLoader, '/miku/talking.vrma')
  ]);
  const idleAnimation = idleGltf.userData.vrmAnimations?.[0];
  const talkingAnimation = talkingGltf.userData.vrmAnimations?.[0];

  if (!idleAnimation) {
    throw new Error('idle.vrma did not contain a VRM animation.');
  }
  if (!talkingAnimation) {
    throw new Error('talking.vrma did not contain a VRM animation.');
  }

  mixer = new THREE.AnimationMixer(vrm.scene);
  idleAction = mixer.clipAction(createVRMAnimationClip(idleAnimation, vrm));
  talkingAction = mixer.clipAction(createVRMAnimationClip(talkingAnimation, vrm));

  try {
    const danceGltf = await parseBinaryAsset(animationLoader, '/miku/dance.vrma');
    const danceAnimation = danceGltf.userData.vrmAnimations?.[0];
    if (!danceAnimation) {
      throw new Error('dance.vrma did not contain a VRM animation.');
    }
    const hipsTranslationTrack = danceAnimation.humanoidTracks.translation.get('hips');
    const initialHipHeight = hipsTranslationTrack?.values[1];
    if (!hipsTranslationTrack || !Number.isFinite(initialHipHeight) || initialHipHeight <= 1e-3) {
      throw new Error('dance.vrma does not have a usable initial hips height.');
    }

    danceAnimation.restHipsPosition.y = initialHipHeight;
    const danceClip = createVRMAnimationClip(danceAnimation, vrm);
    constrainDanceRootMotion(danceClip);
    danceAction = mixer.clipAction(danceClip);
  } catch (error) {
    console.warn('[Animation] Optional dance.vrma unavailable; using the talking animation.', error);
  }

  setSpeakingAnimation(isMikuSpeaking);
}

function createPerformanceStage() {
  const stage = new THREE.Group();
  const width = Math.max(modelSize.x * 5, 2.2);
  const originalDepth = Math.max(modelSize.z * 4, 2);
  const depth = originalDepth * 1.5;
  const thickness = 0.12;
  const stageTop = -modelSize.y / 2 - 0.025;
  performanceStageTop = stageTop;
  const stageZ = 0.15 - (depth - originalDepth) / 2;
  const platformMaterial = new THREE.MeshStandardMaterial({
    color: 0x111526,
    metalness: 0.72,
    roughness: 0.3,
    emissive: 0x10162b,
    emissiveIntensity: 0.5
  });
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(width, thickness, depth),
    platformMaterial
  );
  platform.position.set(0, stageTop - thickness / 2, stageZ);
  stage.add(platform);

  const frontTrim = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.96, 0.025, 0.025),
    new THREE.MeshBasicMaterial({ color: 0x4cecff })
  );
  frontTrim.position.set(0, stageTop - 0.035, stageZ + depth / 2 + 0.006);
  stage.add(frontTrim);

  const lightBars = [
    { x: -width / 3 - 0.1, color: 0xff38c7 },
    { x: width / 3 + 0.1, color: 0x39e8ff }
  ];
  lightBars.forEach(({ x, color }) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 1.1, 0.035),
      new THREE.MeshBasicMaterial({ color })
    );
    bar.position.set(x, stageTop + 0.55, stageZ - depth * 0.2);
    stage.add(bar);
  });

  const target = new THREE.Object3D();
  target.position.set(0, 0, 0.5);
  stage.add(target);

  const spotlights = [
    { color: 0xffedcf, intensity: 8, position: [0, modelSize.y * 1.65, stageZ + 2.2], angle: Math.PI / 5 },
    { color: 0x45eaff, intensity: 6, position: [2.1, modelSize.y * 1.2, stageZ - 1.4], angle: Math.PI / 4 },
    { color: 0xff3abf, intensity: 5, position: [-2.1, modelSize.y * 1.1, stageZ + 0.5], angle: Math.PI / 4 }
  ];
  spotlights.forEach(({ color, intensity, position, angle }) => {
    const spotlight = new THREE.SpotLight(color, intensity, 0, angle, 0.7, 1.2);
    spotlight.position.set(...position);
    spotlight.target = target;
    stage.add(spotlight);
  });

  stage.visible = false;
  scene.add(stage);
  performanceStage = stage;

  const toeBones = ['leftToes', 'rightToes']
    .map((boneName) => vrm.humanoid.getNormalizedBoneNode(boneName))
    .filter(Boolean);
  const footBones = ['leftFoot', 'rightFoot']
    .map((boneName) => vrm.humanoid.getNormalizedBoneNode(boneName))
    .filter(Boolean);
  performanceFootBones = toeBones.length === 2 ? toeBones : footBones;
  performanceFootOffset = toeBones.length === 2 ? 0.015 : 0.08;
  if (performanceFootBones.length !== 2) {
    console.warn('[Animation] Could not find both feet for stage grounding.');
  }
}

function setPerformanceStage(active) {
  if (!performanceStage) return;

  performanceStage.visible = active;
  keyLight.intensity = active ? 0.45 : 2.5;
  vrm.scene.scale.setScalar(active ? 0.92 : 1);
  vrm.scene.position.copy(modelBasePosition);
}

function groundMikuOnStage() {
  if (!performanceFootBones.length) return;

  vrm.scene.updateMatrixWorld(true);
  let lowestFootY = Infinity;
  for (const footBone of performanceFootBones) {
    footBone.getWorldPosition(footWorldPosition);
    lowestFootY = Math.min(lowestFootY, footWorldPosition.y);
  }

  vrm.scene.position.y += performanceStageTop + performanceFootOffset - lowestFootY;
}

function setSpeakingAnimation(isSpeaking, useDance = false, animationAction = null) {
  isMikuSpeaking = isSpeaking;
  const nextAction = isSpeaking
    ? (animationAction || (useDance && danceAction ? danceAction : talkingAction))
    : idleAction;
  if (!nextAction || nextAction === currentAction) return;

  currentAction?.fadeOut(0.2);
  nextAction.reset().fadeIn(0.2).play();
  currentAction = nextAction;
}

function constrainDanceRootMotion(clip) {
  const hipsNode = vrm?.humanoid.getNormalizedBoneNode('hips');
  const hipsPositionTrack = hipsNode
    ? clip.tracks.find((track) => track.name === `${hipsNode.name}.position`)
    : null;
  if (!hipsPositionTrack || hipsPositionTrack.values.length < 3) {
    throw new Error('dance.vrma did not produce a hips position track.');
  }

  const startingX = hipsPositionTrack.values[0];
  const maximumHorizontalTravel = 0.15;
  for (let i = 0; i < hipsPositionTrack.values.length; i += 3) {
    const relativeX = hipsPositionTrack.values[i] - startingX;
    hipsPositionTrack.values[i] = startingX + THREE.MathUtils.clamp(
      relativeX,
      -maximumHorizontalTravel,
      maximumHorizontalTravel
    );
  }
}

function advanceAnimation() {
  const now = performance.now();
  const delta = Math.min((now - previousFrameTime) / 1000, 0.05);
  previousFrameTime = now;

  mixer?.update(delta);
  vrm?.update(delta);
  if (performanceStage?.visible) groundMikuOnStage();
  renderer.render(scene, camera);
}

function resizeRenderer() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  fitCameraToModel();
  renderer.render(scene, camera);
}

function addMessage(text, className) {
  const message = document.createElement('div');
  message.className = className;
  message.textContent = text;

  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
}

function unlockSpeechAudio() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return Promise.reject(new Error('Web Audio API is not supported by this browser.'));
  }

  if (!speechAudioContext) {
    speechAudioContext = new AudioContextConstructor();
  }

  return speechAudioContext.resume();
}

function stopCurrentAction() {
  if (!isActionInProgress) return;

  console.info('[Action] Stop requested.');
  activeActionController?.abort();
  if (currentSpeechSourceStarted) {
    currentSpeechSource?.stop();
  } else if (performanceStage?.visible) {
    void transitionSongScene(null, false, () => setSpeakingAnimation(false));
  } else {
    cancelSongSceneTransition();
    setSongBackground(null);
    setPerformanceStage(false);
    setSpeakingAnimation(false);
  }
}

function setSongBackground(backgroundUrl) {
  if (backgroundUrl) {
    document.documentElement.style.setProperty('--page-background', `url("${backgroundUrl}")`);
  } else {
    document.documentElement.style.removeProperty('--page-background');
  }
}

function cancelSongSceneTransition() {
  sceneTransitionVersion += 1;
  sceneTransition.classList.remove('is-visible');
}

async function transitionSongScene(backgroundUrl, stageActive, onSceneChanged) {
  const transitionVersion = ++sceneTransitionVersion;
  sceneTransition.classList.add('is-visible');
  await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, sceneFadeDuration));
  if (transitionVersion !== sceneTransitionVersion) return false;

  setSongBackground(backgroundUrl);
  setPerformanceStage(stageActive);
  const sceneChangeAccepted = onSceneChanged?.() !== false;

  await new Promise(requestAnimationFrame);
  if (transitionVersion !== sceneTransitionVersion) return false;
  sceneTransition.classList.remove('is-visible');
  return sceneChangeAccepted;
}

async function speakMiku(audioUrl, audioReady, danceForFirstSeconds = 0, signal, animationAction = null, backgroundUrl = null, usePerformanceStage = false) {
  try {
    console.info(`[TTS] Playing converted audio: ${audioUrl}`);
    if (!await audioReady || signal.aborted) return;

    const response = await fetch(audioUrl, { signal });
    if (!response.ok) {
      throw new Error(`Audio file request failed with HTTP ${response.status}.`);
    }

    const audioBuffer = await speechAudioContext.decodeAudioData(await response.arrayBuffer());
    if (signal.aborted) return;

    const source = speechAudioContext.createBufferSource();
    currentSpeechSource = source;
    currentSpeechSourceStarted = false;
    source.buffer = audioBuffer;
    source.connect(speechAudioContext.destination);

    await new Promise((resolve, reject) => {
      let danceTimer = null;
      source.addEventListener('ended', () => {
        if (danceTimer !== null) clearTimeout(danceTimer);
        if (currentSpeechSource === source) {
          currentSpeechSource = null;
          currentSpeechSourceStarted = false;
        }
        console.info(signal.aborted ? '[TTS] Playback stopped.' : '[TTS] Playback finished.');
        const finishScene = usePerformanceStage || backgroundUrl
          ? transitionSongScene(null, false, () => setSpeakingAnimation(false))
          : Promise.resolve(setSpeakingAnimation(false));
        finishScene.then(resolve, reject);
      }, { once: true });

      const startPlayback = () => {
        if (signal.aborted) return false;
        setSpeakingAnimation(true, danceForFirstSeconds > 0, animationAction);
        source.start();
        currentSpeechSourceStarted = true;
        console.info('[TTS] Playback started.');
        return true;
      };
      const songScene = usePerformanceStage || Boolean(backgroundUrl);
      const start = songScene
        ? transitionSongScene(backgroundUrl, usePerformanceStage, startPlayback)
        : Promise.resolve(startPlayback());
      start.then((started) => {
        if (!started) {
          if (currentSpeechSource === source) currentSpeechSource = null;
          if (signal.aborted) {
            resolve();
          } else {
            reject(new Error('Song scene transition was interrupted.'));
          }
        }
      }, reject);

      if (danceForFirstSeconds > 0 && danceAction) {
        console.info(`[Animation] Dance animation active for the first ${danceForFirstSeconds} seconds.`);
        danceTimer = setTimeout(() => {
          console.info('[Animation] Switching from dance to talking animation.');
          setSpeakingAnimation(true);
        }, danceForFirstSeconds * 1000);
      }
    });
  } catch (error) {
    const songSceneActive = performanceStage?.visible
      || document.documentElement.style.getPropertyValue('--page-background') !== '';
    if (songSceneActive) {
      await transitionSongScene(null, false, () => setSpeakingAnimation(false));
    } else {
      setSpeakingAnimation(false);
    }
    currentSpeechSource = null;
    currentSpeechSourceStarted = false;
    if (signal.aborted || error.name === 'AbortError') {
      console.info('[TTS] Playback stopped.');
      return;
    }
    console.error('[TTS] Playback pipeline failed:', error);
  }
}

async function loadSongAnimation(animationUrl) {
  await modelReady;
  if (!animationLoader || !mixer || !vrm) {
    throw new Error('Miku is not ready to load the song animation.');
  }

  if (!songAnimationActions.has(animationUrl)) {
    const actionPromise = parseBinaryAsset(animationLoader, animationUrl).then((gltf) => {
      const animation = gltf.userData.vrmAnimations?.[0];
      if (!animation) {
        throw new Error(`Song animation did not contain a VRM animation: ${animationUrl}`);
      }
      return mixer.clipAction(createVRMAnimationClip(animation, vrm));
    });
    songAnimationActions.set(animationUrl, actionPromise);
    actionPromise.catch(() => songAnimationActions.delete(animationUrl));
  }

  return songAnimationActions.get(animationUrl);
}

async function handleFormSubmit(event) {
  event.preventDefault();

  if (isActionInProgress) {
    stopCurrentAction();
    return;
  }

  const question = questionInput.value.trim();
  if (!question) return;

  isActionInProgress = true;
  activeActionController = new AbortController();
  const actionSignal = activeActionController.signal;

  const audioReady = unlockSpeechAudio()
    .then(() => true)
    .catch((error) => {
      console.error('[TTS] Could not unlock browser audio during submit:', error);
      return false;
    });

  addMessage(`You: ${question}`, 'user-message');

  questionInput.value = '';
  sendButton.disabled = false;
  sendButton.textContent = 'Stop';
  sendButton.classList.add('is-stop');
  sendButton.setAttribute('aria-label', 'Stop current action');

  try {
    if (question === '%ARCHIMEDE%') {
      console.log('[ARCHIMEDE] %ARCHIMEDE%: playing the local Archimede WAV.');
      await speakMiku('/miku/archimede.wav', audioReady, 35, actionSignal);
      return;
    } else if (question === '%ARCHIMEDE2%') {
      console.log('[ARCHIMEDE] %ARCHIMEDE2%: playing the local Archimede2 WAV.');
      await speakMiku('/miku/archimede2.wav', audioReady, 0, actionSignal);
      return;
    }

    const response = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, conversation: conversationHistory }),
      signal: actionSignal
    });

    const data = await response.json();
    if (actionSignal.aborted) return;
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    conversationHistory.push(
      { role: 'user', content: question },
      { role: 'assistant', content: data.answer }
    );
    conversationHistory.splice(0, Math.max(0, conversationHistory.length - 12));

    if (data.song) {
      addMessage(`Miku: ${data.answer}`, 'ai-message');
      const animationAction = await loadSongAnimation(data.song.animationUrl);
      await speakMiku(data.song.audioUrl, audioReady, 0, actionSignal, animationAction, data.song.backgroundUrl, true);
      return;
    } else if (data.answer.trim() === '%CATANIA%') {
      console.info('[CATANIA] Playing the local Catania WAV.');
      await speakMiku('/miku/ale%20catania.wav', audioReady, 35, actionSignal);
    } else {
      addMessage(`Miku: ${data.answer}`, 'ai-message');
    }

    if (data.answer.trim() !== '%CATANIA%' && data.audioUrl) {
      await speakMiku(data.audioUrl, audioReady, 0, actionSignal);
    } else if (data.answer.trim() !== '%CATANIA%' && data.audioError) {
      console.error('[TTS] No converted audio URL was returned:', data.audioError);
    }
  } catch (error) {
    if (actionSignal.aborted || error.name === 'AbortError') {
      console.info('[Action] Current action stopped.');
    } else {
      console.error(error);
      addMessage('Miku: Sorry, something went wrong!', 'ai-message');
    }
  } finally {
    isActionInProgress = false;
    activeActionController = null;
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
    sendButton.classList.remove('is-stop');
    sendButton.setAttribute('aria-label', 'Send message');
    questionInput.focus();
  }
}

renderer.setAnimationLoop(advanceAnimation);
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

chatForm.addEventListener('submit', handleFormSubmit);
sendButton.addEventListener('click', (event) => {
  if (isActionInProgress) {
    event.preventDefault();
    stopCurrentAction();
  }
});

const modelReady = loadModelAndIdle();
modelReady.catch((error) => {
  console.error('Could not load Miku and idle animation:', error);
});
