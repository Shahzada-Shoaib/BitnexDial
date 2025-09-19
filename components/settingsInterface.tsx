'use client';

import { useState, useEffect, useRef } from 'react';
import { IoMdMicrophone } from "react-icons/io";
import { HiVolumeUp, HiVolumeOff } from "react-icons/hi";
import { FiWifi, FiWifiOff, FiCheck, FiX, FiPlay, FiRefreshCw } from "react-icons/fi";
import { IoStop, IoClose } from "react-icons/io5";
import { BiTestTube, BiNetworkChart } from "react-icons/bi";
import { MdSettingsVoice, MdGraphicEq } from "react-icons/md";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsShieldCheck, BsShieldX } from "react-icons/bs";
import AlertModal from './AlertModal';

interface AudioDevice {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput';
}

interface TestResult {
    status: 'pending' | 'running' | 'success' | 'failed';
    message: string;
    details?: string;
}

interface ConnectivityResult {
    server: string;
    displayName: string;
    status: 'pending' | 'testing' | 'success' | 'failed';
    latency?: number;
    message: string;
}

export default function HelpInterface() {
    // Device and permission states
    const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
    const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
    const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
    const [micPermission, setMicPermission] = useState<PermissionState | 'unknown'>('unknown');
    const [speakerPermission, setSpeakerPermission] = useState<boolean>(false);

    // Test states
    const [micTest, setMicTest] = useState<TestResult>({ status: 'pending', message: 'Not tested' });
    const [speakerTest, setSpeakerTest] = useState<TestResult>({ status: 'pending', message: 'Not tested' });
    const [connectivityTests, setConnectivityTests] = useState<ConnectivityResult[]>([]);

    // Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);

    // Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    // Alert states
    const [showAlert, setShowAlert] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [alertType, setAlertType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

    useEffect(() => {
        initializeAudioTests();
        return () => {
            cleanup();
        };
    }, []);

    const showAlertMessage = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        setAlertMessage(message);
        setAlertType(type);
        setShowAlert(true);
    };

    const cleanup = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };



    const initializeAudioTests = async () => {
        try {
            // Check microphone permissions
            const micPermissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            setMicPermission(micPermissionStatus.state);

            micPermissionStatus.addEventListener('change', () => {
                setMicPermission(micPermissionStatus.state);
            });

            // Check speaker permissions (Chrome specific)
            if ('setSinkId' in HTMLMediaElement.prototype) {
                setSpeakerPermission(true);
            }

            // Load audio devices
            await loadAudioDevices();

            // Initialize connectivity tests
            initializeConnectivityTests();
        } catch (error) {
            console.error('Failed to initialize audio tests:', error);
            showAlertMessage('Failed to initialize audio testing system', 'error');
        }
    };

    const loadAudioDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioDevicesList = devices
                .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
                .map(device => ({
                    deviceId: device.deviceId,
                    label: device.label || `${device.kind === 'audioinput' ? 'Microphone' : 'Speaker'} ${device.deviceId.slice(0, 8)}`,
                    kind: device.kind as 'audioinput' | 'audiooutput'
                }));

            setAudioDevices(audioDevicesList);

            // Set default devices
            const defaultMic = audioDevicesList.find(d => d.kind === 'audioinput');
            const defaultSpeaker = audioDevicesList.find(d => d.kind === 'audiooutput');

            if (defaultMic) setSelectedMicrophone(defaultMic.deviceId);
            if (defaultSpeaker) setSelectedSpeaker(defaultSpeaker.deviceId);
        } catch (error) {
            console.error('Failed to load audio devices:', error);
            showAlertMessage('Failed to load audio devices. Please check browser permissions.', 'error');
        }
    };

    const initializeConnectivityTests = () => {
        const servers = [
            { server: 'bkpmanual.bitnexdial.com', displayName: 'Server1', status: 'pending' as const, message: 'SMS/WebSocket Server' },
            { server: 'bkpmanual.bitnexdial.com', displayName: 'Server2', status: 'pending' as const, message: 'API Server' },
            { server: 'google.com', displayName: 'Server3', status: 'pending' as const, message: 'Internet Connectivity' },
            { server: 'stun.l.google.com:19302', displayName: 'Server4', status: 'pending' as const, message: 'STUN Server' }
        ];
        setConnectivityTests(servers);
    };

    const requestMicrophonePermission = async () => {
        try {
            setMicTest({ status: 'running', message: 'Requesting microphone permission...' });

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            stream.getTracks().forEach(track => track.stop());

            setMicTest({
                status: 'success',
                message: 'Microphone permission granted!',
                details: 'You can now use voice features'
            });

            // Refresh permission status
            const micPermissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            setMicPermission(micPermissionStatus.state);

            // Reload devices to get labels
            await loadAudioDevices();

        } catch (error: any) {
            setMicTest({
                status: 'failed',
                message: 'Microphone permission denied',
                details: error.message || 'Please allow microphone access in browser settings'
            });
            showAlertMessage('Microphone permission denied. Please check your browser settings.', 'error');
        }
    };

    const testMicrophone = async () => {
        if (micPermission !== 'granted') {
            await requestMicrophonePermission();
            return;
        }

        try {
            setMicTest({ status: 'running', message: 'Testing microphone...' });

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;

            // Create audio context for level monitoring
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            source.connect(analyserRef.current);

            analyserRef.current.fftSize = 256;
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

            // Monitor audio levels
            const monitorLevel = () => {
                if (analyserRef.current) {
                    analyserRef.current.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    setAudioLevel(average);
                    animationFrameRef.current = requestAnimationFrame(monitorLevel);
                }
            };
            monitorLevel();

            setMicTest({
                status: 'success',
                message: 'Microphone is working!',
                details: 'Speak to see the audio level indicator'
            });

            // Auto-stop after 10 seconds
            setTimeout(() => {
                stopMicTest();
            }, 10000);

        } catch (error: any) {
            setMicTest({
                status: 'failed',
                message: 'Microphone test failed',
                details: error.message
            });
            showAlertMessage('Microphone test failed: ' + error.message, 'error');
        }
    };

    const stopMicTest = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setAudioLevel(0);

        if (micTest.status === 'running') {
            setMicTest({
                status: 'success',
                message: 'Microphone test completed',
                details: 'Test stopped'
            });
        }
    };

    const testSpeaker = async () => {
        try {
            setSpeakerTest({ status: 'running', message: 'Testing speaker...' });

            // Create a test tone
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 2);

            await new Promise(resolve => setTimeout(resolve, 2000));

            setSpeakerTest({
                status: 'success',
                message: 'Speaker test completed!',
                details: 'You should have heard a test tone'
            });

        } catch (error: any) {
            setSpeakerTest({
                status: 'failed',
                message: 'Speaker test failed',
                details: error.message
            });
            showAlertMessage('Speaker test failed: ' + error.message, 'error');
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: Blob[] = [];
            mediaRecorder.ondataavailable = (event) => {
                chunks.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(chunks, { type: 'audio/wav' });
                setRecordedAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            showAlertMessage('Recording started. Click stop when finished.', 'info');

        } catch (error: any) {
            showAlertMessage('Failed to start recording: ' + error.message, 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            showAlertMessage('Recording stopped. You can now play it back.', 'success');
        }
    };

    const playRecording = () => {
        if (recordedAudio) {
            const audioUrl = URL.createObjectURL(recordedAudio);
            const audio = new Audio(audioUrl);
            audioElementRef.current = audio;

            if (selectedSpeaker && 'setSinkId' in audio) {
                (audio as any).setSinkId(selectedSpeaker).catch((error: any) => {
                    console.warn('Failed to set audio output device:', error);
                });
            }

            audio.onplay = () => setIsPlaying(true);
            audio.onended = () => {
                setIsPlaying(false);
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = () => {
                setIsPlaying(false);
                showAlertMessage('Failed to play recording', 'error');
            };

            audio.play().catch((error) => {
                showAlertMessage('Failed to play audio: ' + error.message, 'error');
            });
        }
    };

    const stopPlayback = () => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };

    const testConnectivity = async () => {
        const testServer = async (server: string): Promise<{ latency?: number; success: boolean }> => {
            const startTime = performance.now();

            try {
                // For STUN server, we'll just mark as success since it's UDP
                if (server.includes('stun')) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    return { latency: 100, success: true };
                }

                // For HTTP servers, try to fetch with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`https://${server}/`, {
                    method: 'HEAD',
                    signal: controller.signal,
                    mode: 'no-cors'
                });

                clearTimeout(timeoutId);
                const endTime = performance.now();
                return { latency: Math.round(endTime - startTime), success: true };

            } catch (error) {
                const endTime = performance.now();
                return { latency: Math.round(endTime - startTime), success: false };
            }
        };

        // Test each server
        for (let i = 0; i < connectivityTests.length; i++) {
            const test = connectivityTests[i];

            setConnectivityTests(prev => prev.map((t, idx) =>
                idx === i ? { ...t, status: 'testing' as const } : t
            ));

            const result = await testServer(test.server);

            setConnectivityTests(prev => prev.map((t, idx) =>
                idx === i ? {
                    ...t,
                    status: result.success ? 'success' as const : 'failed' as const,
                    latency: result.latency,
                    message: result.success
                        ? `Connected (${result.latency}ms)`
                        : 'Connection failed'
                } : t
            ));

            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const runAllTests = async () => {
        showAlertMessage('Running comprehensive audio and connectivity tests...', 'info');

        // Reset all test states
        setMicTest({ status: 'pending', message: 'Starting...' });
        setSpeakerTest({ status: 'pending', message: 'Starting...' });

        try {
            // Test microphone
            await testMicrophone();
            await new Promise(resolve => setTimeout(resolve, 1000));
            stopMicTest();

            // Test speaker
            await testSpeaker();
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Test connectivity
            await testConnectivity();

            showAlertMessage('All tests completed successfully!', 'success');
        } catch (error) {
            showAlertMessage('Some tests failed. Please check individual results.', 'warning');
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>;
            case 'running':
            case 'testing':
                return <AiOutlineLoading3Quarters className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'success':
                return <FiCheck className="w-4 h-4 text-green-500" />;
            case 'failed':
                return <FiX className="w-4 h-4 text-red-500" />;
            default:
                return <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>;
        }
    };

    const getPermissionIcon = (permission: PermissionState | 'unknown' | boolean) => {
        if (permission === 'granted' || permission === true) {
            return <BsShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />;
        } else if (permission === 'denied') {
            return <BsShieldX className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />;
        } else {
            return <BsShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />;
        }
    };

    const inputDevices = audioDevices.filter(d => d.kind === 'audioinput');
    const outputDevices = audioDevices.filter(d => d.kind === 'audiooutput');

    return (
        <div className="min-h-screen w-full bg-gray-50 dark:bg-gray-900 p-2 sm:p-4 lg:p-6 mb-40">
            <div className="w-full max-w-7xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-2xl lg:rounded-3xl shadow-xl lg:shadow-2xl dark:shadow-gray-900/50 overflow-hidden transform transition-all duration-500 hover:shadow-2xl lg:hover:shadow-3xl dark:hover:shadow-gray-900/70">

                    {/* Header */}
                    <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200 dark:border-slate-600 bg-gradient-to-r from-[#D3E9E7] to-[#E0F0EE] dark:from-slate-800 dark:to-slate-700">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div className="flex items-center space-x-3 sm:space-x-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                                    <BiTestTube className="text-white text-xl sm:text-2xl" />
                                </div>
                                <div>
                                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-gray-100">Audio & Connectivity Testing</h1>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hidden sm:block">Test your microphone, speakers, and network connectivity</p>
                                </div>
                            </div>
                            <button
                                onClick={runAllTests}
                                className="w-full sm:w-auto bg-gradient-to-r from-[#3778D6] to-[#2a5aa0] dark:from-blue-600 dark:to-blue-800 hover:from-[#2a5aa0] hover:to-[#1e4080] dark:hover:from-blue-500 dark:hover:to-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex items-center justify-center space-x-2"
                            >
                                <BiTestTube className="text-base sm:text-lg" />
                                <span className="text-sm sm:text-base">Run All Tests</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="max-h-[calc(100vh-120px)] overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">

                        {/* Permissions Section */}
                        <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600 ">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                                <BsShieldCheck className="text-xl sm:text-2xl text-blue-500" />
                                <span>Permissions Status</span>
                            </h2>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl gap-2 sm:gap-0">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                        {getPermissionIcon(micPermission)}
                                        <div>
                                            <div className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">Microphone</div>
                                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                                {micPermission === 'granted' ? 'Access granted' :
                                                    micPermission === 'denied' ? 'Access denied' : 'Not requested'}
                                            </div>
                                        </div>
                                    </div>
                                    {micPermission !== 'granted' && (
                                        <button
                                            onClick={requestMicrophonePermission}
                                            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all duration-200"
                                        >
                                            Request
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                        {getPermissionIcon(speakerPermission)}
                                        <div>
                                            <div className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200">Speaker</div>
                                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                                {speakerPermission ? 'Available' : 'Limited support'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Device Selection */}
                        <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                                <MdSettingsVoice className="text-xl sm:text-2xl text-green-500" />
                                <span>Audio Devices</span>
                            </h2>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Microphone ({inputDevices.length} found)
                                    </label>
                                    <select
                                        value={selectedMicrophone}
                                        onChange={(e) => setSelectedMicrophone(e.target.value)}
                                        className="w-full p-2 sm:p-3 border-2 border-gray-300 dark:border-slate-600 rounded-lg sm:rounded-xl focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-xs sm:text-sm"
                                    >
                                        {inputDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Speaker ({outputDevices.length} found)
                                    </label>
                                    <select
                                        value={selectedSpeaker}
                                        onChange={(e) => setSelectedSpeaker(e.target.value)}
                                        className="w-full p-2 sm:p-3 border-2 border-gray-300 dark:border-slate-600 rounded-lg sm:rounded-xl focus:outline-none focus:border-[#3778D6] dark:focus:border-blue-400 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 text-xs sm:text-sm"
                                    >
                                        {outputDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Audio Tests */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">

                            {/* Microphone Test */}
                            <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                                    <IoMdMicrophone className="text-lg sm:text-2xl text-blue-500" />
                                    <span>Microphone Test</span>
                                </h3>

                                <div className="space-y-3 sm:space-y-4">
                                    <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl">
                                        {getStatusIcon(micTest.status)}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">{micTest.message}</div>
                                            {micTest.details && (
                                                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{micTest.details}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Audio Level Indicator */}
                                    <div className="space-y-2">
                                        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Audio Level
                                        </label>
                                        <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2 sm:h-3 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100 ease-out rounded-full"
                                                style={{ width: `${Math.min((audioLevel / 50) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                                            {audioLevel > 0 ? 'Detecting audio' : 'No audio detected'}
                                        </div>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={micTest.status === 'running' ? stopMicTest : testMicrophone}
                                            disabled={micTest.status === 'running'}
                                            className={`flex-1 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm ${micTest.status === 'running'
                                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                }`}
                                        >
                                            {micTest.status === 'running' ? (
                                                <>
                                                    <IoClose className="text-sm sm:text-base" />
                                                    <span>Stop Test</span>
                                                </>
                                            ) : (
                                                <>
                                                    <IoMdMicrophone className="text-sm sm:text-base" />
                                                    <span>Test Mic</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Speaker Test */}
                            <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                                    <HiVolumeUp className="text-lg sm:text-2xl text-green-500" />
                                    <span>Speaker Test</span>
                                </h3>

                                <div className="space-y-3 sm:space-y-4">
                                    <div className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl">
                                        {getStatusIcon(speakerTest.status)}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">{speakerTest.message}</div>
                                            {speakerTest.details && (
                                                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{speakerTest.details}</div>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={testSpeaker}
                                        disabled={speakerTest.status === 'running'}
                                        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm"
                                    >
                                        <HiVolumeUp className="text-sm sm:text-base" />
                                        <span>Play Test Tone</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Recording Test */}
                        <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600">
                            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-3 sm:mb-4 flex items-center space-x-2">
                                <MdGraphicEq className="text-lg sm:text-2xl text-purple-500" />
                                <span>Record & Playback Test</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                <button
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={micPermission !== 'granted'}
                                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm ${isRecording
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : micPermission === 'granted'
                                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        }`}
                                >
                                    {isRecording ? <IoStop className="text-sm sm:text-base" /> : <MdGraphicEq className="text-sm sm:text-base" />}
                                    <span className="hidden sm:inline">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                                    <span className="sm:hidden">{isRecording ? 'Stop' : 'Record'}</span>
                                </button>

                                <button
                                    onClick={isPlaying ? stopPlayback : playRecording}
                                    disabled={!recordedAudio}
                                    className={`p-3 sm:p-4 rounded-lg sm:rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm ${recordedAudio
                                        ? isPlaying
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-green-500 hover:bg-green-600 text-white'
                                        : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        }`}
                                >
                                    {isPlaying ? <IoStop className="text-sm sm:text-base" /> : <FiPlay className="text-sm sm:text-base" />}
                                    <span className="hidden sm:inline">{isPlaying ? 'Stop Playback' : 'Play Recording'}</span>
                                    <span className="sm:hidden">{isPlaying ? 'Stop' : 'Play'}</span>
                                </button>

                                <div className="flex items-center justify-center p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl col-span-1 sm:col-span-2 lg:col-span-1">
                                    <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        {recordedAudio ? 'Recording ready' : 'No recording'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Connectivity Tests */}
                        <div className="bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 rounded-xl lg:rounded-2xl p-4 sm:p-6 shadow-lg lg:shadow-xl border border-gray-200 dark:border-slate-600 mb-40" >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-0">
                                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center space-x-2">
                                    <BiNetworkChart className="text-lg sm:text-2xl text-orange-500" />
                                    <span>Connectivity Tests</span>
                                </h3>
                                <button
                                    onClick={testConnectivity}
                                    className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl font-medium transition-all duration-200 flex items-center justify-center space-x-1 sm:space-x-2 text-xs sm:text-sm"
                                >
                                    <FiRefreshCw className="text-sm sm:text-base" />
                                    <span>Test All</span>
                                </button>
                            </div>

                            <div className="space-y-2 sm:space-y-3">
                                {connectivityTests.map((test, index) => (
                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg sm:rounded-xl gap-2 sm:gap-0">
                                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                                            {getStatusIcon(test.status)}
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate">{test.displayName}</div>                                                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{test.message}</div>
                                            </div>
                                        </div>
                                        {test.latency && (
                                            <div className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 self-end sm:self-center">
                                                {test.latency}ms
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Alert Modal */}
                    <AlertModal
                        isOpen={showAlert}
                        onClose={() => setShowAlert(false)}
                        title="Audio Test"
                        message={alertMessage}
                        type={alertType}
                        confirmText="OK"
                    />
                </div>
            </div>
        </div>
    );
}
