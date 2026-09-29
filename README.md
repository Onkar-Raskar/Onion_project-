# 🧅 SIH Onion Grader (Edge ML + React Native)

This repository contains an end-to-end Smart India Hackathon (SIH) project for automated onion grading, quality assessment, and cryptographic certification. It is designed to work in Indian mandis with poor internet connectivity using an offline-first architecture.

## Repository Structure

The project is divided into two parts:
1. **Python FastAPI Backend** (Root Directory): Computer vision models (YOLOv8 + OpenCV) that perform defect detection, size estimation, and tracking on onion crates.
2. **React Native Mobile App** (`/onion-grader`): The frontend application built with Expo for data capture (photos/videos), offline queueing, simulation, and generating PDF certificates.

---

## ⚙️ 1. Setting Up the Backend (Python / FastAPI)

The backend handles the core ML processing. It analyzes image and video streams, estimates the physical diameter of the onions, and identifies diseases/defects using the trained YOLOv8 model (`best.pt`).

### Prerequisites
- Python 3.9+
- A working camera or pre-recorded `.mp4` / `.jpg` files for testing.

### Installation

1. Navigate to the root folder:
   ```bash
   cd SIH_Onion
   ```
2. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Ensure that the YOLO model `best.pt` is present in the root directory.

### Running the Server
Run the FastAPI development server:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```
> **Note:** We run this on `0.0.0.0` so your mobile device can access the server over the local Wi-Fi network. Find your computer's IP address (e.g., `192.168.x.x`) to connect the mobile app.

---

## 📱 2. Setting Up the Mobile App (React Native / Expo)

The mobile app is an offline-first Expo Router application. It supports Hindi, Marathi, and English, features a dark mode, and implements local queueing when the backend is unreachable.

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go app installed on your Android/iOS device (for testing).

### Installation

1. Navigate to the app directory:
   ```bash
   cd SIH_Onion/onion-grader
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```

### Running the App

1. Start the Expo bundler:
   ```bash
   npx expo start -c
   ```
2. Scan the QR code with the Expo Go app on your physical device.

### Connecting to the Backend
When the app launches, go to the **Settings** tab. 
Change the `Backend Server IP` to match the IP address of the machine running the FastAPI server.
- Example: `http://192.168.1.5:8000`

---

## 🌟 Key Features

* **Offline-First Architecture**: If the backend drops (mandi network issues), the app automatically queues scans into local storage and syncs them automatically when connectivity is restored.
* **What-If Simulator**: Allows traders/officials to dynamically adjust the minimum size threshold (e.g., applying NAFED URS policies from 45mm to 35mm) and instantly recalculate batch value without physical resorting.
* **Cryptographic PDF Certificates**: Generates a shareable receipt summarizing the exact grade percentages (Premium A, Commercial C, Reject URS) and defect distributions.
* **Multi-Format Processing**: Seamlessly handles both live camera feeds (photos/videos) and local gallery uploads.
* **Multi-Lingual**: Built-in support for English, Hindi (हिंदी), and Marathi (मराठी) to support local farmers.

## 📜 Grading Standards Applied
By default, the backend is configured strictly according to Indian Agricultural Standards:
- **Premium (Grade A)**: ≥ 45.0 mm diameter (NAFED standard).
- **Commercial (Grade C)**: 20 mm - 45 mm diameter.
- **Reject (URS)**: < 20 mm or possessing critical defects (rot, smut, sprouting) according to AGMARK specifications.
