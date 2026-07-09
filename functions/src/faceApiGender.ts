/**
 * اختياري — تحليل الجنس عبر @vladmandic/face-api (محلي على Cloud Functions)
 * ضع النماذج في functions/models/ — راجع FACE_API_MODELS.md
 * إن لم تُثبَّت الحزم الاختيارية يُستخدم Gemini / HuggingFace / AWS.
 */
// @ts-nocheck
import * as path from 'path';
import type { Gender } from './kycVerification.shared';

type FaceApiResult = { gender: Gender; confidence: number } | null;

let modelsReady = false;
let loadFailed = false;

async function ensureFaceApi(): Promise<boolean> {
  if (loadFailed) return false;
  if (modelsReady) return true;
  try {
    const faceapi = require('@vladmandic/face-api');
    const canvas = require('canvas');
    const tf = require('@tensorflow/tfjs-node');

    const { Canvas, Image, ImageData } = canvas;
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    const modelsPath = path.join(__dirname, '..', 'models');
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
      faceapi.nets.ageGenderNet.loadFromDisk(modelsPath),
    ]);

    await tf.ready();
    modelsReady = true;
    return true;
  } catch (e) {
    console.warn('face-api models unavailable, fallback to cloud AI:', e);
    loadFailed = true;
    return false;
  }
}

/** confidence 0–100 */
export async function detectGenderWithFaceApi(imageBytes: Buffer): Promise<FaceApiResult> {
  if (!(await ensureFaceApi())) return null;

  try {
    const faceapi = require('@vladmandic/face-api');
    const { loadImage } = require('canvas');

    const img = await loadImage(imageBytes);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
      .withAgeAndGender();

    if (!detection) return null;

    const prob = detection.genderProbability ?? 0.5;
    const isFemale = detection.gender === 'female';
    const confidence = Math.round((isFemale ? prob : 1 - prob) * 100);

    return {
      gender: isFemale ? 'female' : 'male',
      confidence,
    };
  } catch (e) {
    console.warn('face-api detection failed:', e);
    return null;
  }
}
