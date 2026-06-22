'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function VideoBackgroundScene({ src = '/videos/background-loop.mp4' }) {
  const mountRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let animationId = 0;
    let disposed = false;

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const video = document.createElement('video');
    video.src = src;
    video.muted = false;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const uniforms = {
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
      uVideoAspect: { value: 16 / 9 },
      uTime: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform float uVideoAspect;
        uniform float uTime;
        varying vec2 vUv;

        vec2 coverUv(vec2 uv, float screenAspect, float imageAspect) {
          vec2 scale = vec2(1.0);

          if (screenAspect > imageAspect) {
            scale.y = imageAspect / screenAspect;
          } else {
            scale.x = screenAspect / imageAspect;
          }

          return (uv - 0.5) * scale + 0.5;
        }

        void main() {
          float screenAspect = uResolution.x / uResolution.y;
          vec2 uv = coverUv(vUv, screenAspect, uVideoAspect);

          vec3 color = texture2D(uTexture, uv).rgb;

          // Small cybernetic grade so the MP4 feels welded into the Three.js scene.
          color *= 1.12;
          color += 0.025 * sin(uTime + vec3(0.0, 2.2, 4.4));

          // Soft vignette to keep UI readable.
          float d = distance(vUv, vec2(0.5));
          color *= 1.0 - smoothstep(0.45, 0.88, d) * 0.42;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const backgroundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(backgroundMesh);

    // Little Three.js sparkle/rain layer so it is not "just a video".
    const particleCount = 520;
    const positions = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      positions[i * 3 + 0] = Math.random() * 2 - 1;
      positions[i * 3 + 1] = Math.random() * 2 - 1;
      positions[i * 3 + 2] = 0;
      speeds[i] = 0.0015 + Math.random() * 0.0045;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.0065,
      color: 0xffffff,
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    const tryPlay = async () => {
      try {
        await video.play();
        if (!disposed) setVideoReady(true);
      } catch {
        // Some browsers may delay autoplay until the page has focus.
        // It is muted and playsInline, so it should retry successfully.
      }
    };

    const handleLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        uniforms.uVideoAspect.value = video.videoWidth / video.videoHeight;
      }
      tryPlay();
    };

    const handleCanPlay = () => {
      setVideoReady(true);
      tryPlay();
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.load();
    tryPlay();

    const onVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        tryPlay();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      uniforms.uResolution.value.set(width, height);
    };

    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;

      const elapsed = clock.getElapsedTime();
      uniforms.uTime.value = elapsed;

      const pos = particleGeometry.attributes.position.array;
      for (let i = 0; i < particleCount; i += 1) {
        const yIndex = i * 3 + 1;
        pos[yIndex] -= speeds[i];

        if (pos[yIndex] < -1.08) {
          pos[yIndex] = 1.08;
          pos[i * 3 + 0] = Math.random() * 2 - 1;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationId);

      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.pause();
      video.removeAttribute('src');
      video.load();

      texture.dispose();
      material.dispose();
      backgroundMesh.geometry.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src]);

  return (
    <section className="videoScene">
      <div ref={mountRef} className="threeMount" />

      {!videoReady && (
        <div className="loader">
          <span className="dot" />
          Loading...
        </div>
      )}

      <div className="ui">
        <div className="glassCard">
          <p className="eyebrow">//ĒVĒ//</p>
        
        </div>
      </div>
    </section>
  );
}
