import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 0.01, 1000 );

const renderer = new THREE.WebGLRenderer( { alpha: true } );
renderer.setPixelRatio( Math.min( window.devicePixelRatio, 2 ) );
renderer.setClearColor( 0x000000, 0 );
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

scene.add( new THREE.HemisphereLight( 0xffffff, 0x333344, 2 ) );
const keyLight = new THREE.DirectionalLight( 0xffffff, 2.5 );
keyLight.position.set( 3, 6, 8 );
scene.add( keyLight );

let modelSize;
let vrm;
let mixer;
let previousFrameTime = performance.now();

function fitCameraToModel() {
    if ( !modelSize ) return;

    const verticalFov = THREE.MathUtils.degToRad( camera.fov );
    const horizontalFov = 2 * Math.atan( Math.tan( verticalFov / 2 ) * camera.aspect );
    const limitingFov = Math.min( verticalFov, horizontalFov );
    const radius = modelSize.length() / 2;
    const distance = radius / Math.sin( limitingFov / 2 ) * 1.1;

    camera.position.set( 0, 0, distance );
    camera.near = Math.max( distance / 100, 0.01 );
    camera.far = distance * 10;
    camera.lookAt( 0, 0, 0 );
    camera.updateProjectionMatrix();
}

function parseBinaryAsset( loader, url ) {
    return fetch( url ).then( ( response ) => {
        if ( !response.ok ) throw new Error( `Asset request failed (${response.status}): ${url}` );
        return response.arrayBuffer();
    } ).then( ( data ) => new Promise( ( resolve, reject ) => {
        loader.parse( data, '/miku/', resolve, reject );
    } ) );
}

async function loadModelAndIdle() {
    const modelLoader = new GLTFLoader();
    modelLoader.register( ( parser ) => new VRMLoaderPlugin( parser ) );
    const modelGltf = await parseBinaryAsset( modelLoader, '/miku/Miku4.vrm' );
    vrm = modelGltf.userData.vrm;

    if ( !vrm ) throw new Error( 'Miku4.vrm did not contain a VRM avatar.' );

    VRMUtils.rotateVRM0( vrm );
    const bounds = new THREE.Box3().setFromObject( vrm.scene );
    const center = bounds.getCenter( new THREE.Vector3() );
    modelSize = bounds.getSize( new THREE.Vector3() );
    vrm.scene.position.sub( center );
    scene.add( vrm.scene );
    fitCameraToModel();

    const animationLoader = new GLTFLoader();
    animationLoader.register( ( parser ) => new VRMAnimationLoaderPlugin( parser ) );
    const animationGltf = await parseBinaryAsset( animationLoader, '/miku/idle.vrma' );
    const vrmAnimation = animationGltf.userData.vrmAnimations?.[0];

    if ( !vrmAnimation ) throw new Error( 'idle_2.vrma did not contain a VRM animation.' );

    mixer = new THREE.AnimationMixer( vrm.scene );
    mixer.clipAction( createVRMAnimationClip( vrmAnimation, vrm ) ).play();
}

function advanceAnimation() {
    const now = performance.now();
    const delta = Math.min( ( now - previousFrameTime ) / 1000, 0.05 );
    previousFrameTime = now;

    if ( mixer ) mixer.update( delta );
    if ( vrm ) vrm.update( delta );

    renderer.render( scene, camera );
}

function resizeRenderer() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    fitCameraToModel();
    renderer.render( scene, camera );
}

renderer.setAnimationLoop( advanceAnimation );

window.addEventListener( 'resize', resizeRenderer );
resizeRenderer();
loadModelAndIdle().catch( ( error ) => console.error( 'Could not load Miku and idle animation:', error ) );
