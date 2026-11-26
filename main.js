import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(3, 6, 8);
scene.add(keyLight);

let modelSize = null;
let vrm = null;
let mixer = null;
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

const chat = document.getElementById('chat');
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
  scene.add(vrm.scene);
  fitCameraToModel();

  const animationLoader = new GLTFLoader();
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

function setSpeakingAnimation(isSpeaking, useDance = false) {
  isMikuSpeaking = isSpeaking;
  const nextAction = isSpeaking
    ? (useDance && danceAction ? danceAction : talkingAction)
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
  currentSpeechSource?.stop();
  setSpeakingAnimation(false);
}

async function speakMiku(audioUrl, audioReady, danceForFirstSeconds = 0, signal) {
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
    source.buffer = audioBuffer;
    source.connect(speechAudioContext.destination);

    await new Promise((resolve, reject) => {
      let danceTimer = null;
      source.addEventListener('ended', () => {
        if (danceTimer !== null) clearTimeout(danceTimer);
        if (currentSpeechSource === source) currentSpeechSource = null;
        console.info(signal.aborted ? '[TTS] Playback stopped.' : '[TTS] Playback finished.');
        setSpeakingAnimation(false);
        resolve();
      }, { once: true });
      console.info('[TTS] Playback started.');
      setSpeakingAnimation(true, danceForFirstSeconds > 0);
      source.start();
      if (danceForFirstSeconds > 0 && danceAction) {
        console.info(`[Animation] Dance animation active for the first ${danceForFirstSeconds} seconds.`);
        danceTimer = setTimeout(() => {
          console.info('[Animation] Switching from dance to talking animation.');
          setSpeakingAnimation(true);
        }, danceForFirstSeconds * 1000);
      }
    });
  } catch (error) {
    setSpeakingAnimation(false);
    if (signal.aborted || error.name === 'AbortError') {
      console.info('[TTS] Playback stopped.');
      return;
    }
    console.error('[TTS] Playback pipeline failed:', error);
  }
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
      console.info('[ARCHIMEDE] %ARCHIMEDE%: playing the local Archimede WAV.');
      await speakMiku('/miku/archimede.wav', audioReady, 35, actionSignal);
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

    if (data.answer.trim() === '%CATANIA%') {
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

loadModelAndIdle().catch((error) => {
  console.error('Could not load Miku and idle animation:', error);
});
