package com.rishabh.renopay;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int SPEECH_REQUEST_CODE = 1002;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1003;
    private static final int GALLERY_PICK_REQUEST_CODE = 1004;
    private ValueCallback<Uri[]> mFilePathCallback;

    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;
    private String pendingSpeakText = null;
    private String pendingSpeakLang = null;
    private String pendingVoiceLang = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RenoTTSPlugin.class);
        super.onCreate(savedInstanceState);
        checkAndRequestAppPermissions();
        initTextToSpeech();
        setupJavascriptInterfaces();
        configureWebViewForAudio();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupJavascriptInterfaces();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupJavascriptInterfaces();
    }

    private void checkAndRequestAppPermissions() {
        ArrayList<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P) {
            perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }

        ArrayList<String> needed = new ArrayList<>();
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needed.add(perm);
            }
        }
        if (!needed.isEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
        }
    }

    private void configureWebViewForAudio() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    WebView wv = getBridge().getWebView();
                    // Ensure microphone and camera permissions requested inside WebView on Android 10+ are granted
                    final WebChromeClient existingClient = wv.getWebChromeClient();
                    wv.setWebChromeClient(new WebChromeClient() {
                        @Override
                        public void onPermissionRequest(final PermissionRequest request) {
                            runOnUiThread(() -> {
                                try {
                                    request.grant(request.getResources());
                                } catch (Exception e) {
                                    if (existingClient != null) {
                                        existingClient.onPermissionRequest(request);
                                    } else {
                                        super.onPermissionRequest(request);
                                    }
                                }
                            });
                        }

                        @Override
                        public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                            if (mFilePathCallback != null) {
                                mFilePathCallback.onReceiveValue(null);
                            }
                            mFilePathCallback = filePathCallback;
                            try {
                                Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
                                intent.setType("image/*");
                                startActivityForResult(Intent.createChooser(intent, "Select QR Code Image"), FILE_CHOOSER_REQUEST_CODE);
                                return true;
                            } catch (Exception e) {
                                try {
                                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                                    intent.setType("image/*");
                                    startActivityForResult(Intent.createChooser(intent, "Select QR Code Image"), FILE_CHOOSER_REQUEST_CODE);
                                    return true;
                                } catch (Exception ex) {
                                    if (mFilePathCallback != null) {
                                        mFilePathCallback.onReceiveValue(null);
                                        mFilePathCallback = null;
                                    }
                                    return false;
                                }
                            }
                        }
                    });
                }
            } catch (Exception ignored) {}
        }, 500);
    }

    private void initTextToSpeech() {
        try {
            textToSpeech = new TextToSpeech(getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS) {
                    isTtsInitialized = true;

                    // Modern AudioAttributes for Android 10+ (API 29+)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                        textToSpeech.setAudioAttributes(audioAttributes);
                    }

                    applyTtsLanguage("hi");

                    textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override
                        public void onStart(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechStart && window.__onSaathiSpeechStart();", null
                                    );
                                }
                            });
                        }

                        @Override
                        public void onDone(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechEnd && window.__onSaathiSpeechEnd();", null
                                    );
                                }
                            });
                        }

                        @Override
                        public void onError(String utteranceId) {
                            runOnUiThread(() -> {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.__onSaathiSpeechEnd && window.__onSaathiSpeechEnd();", null
                                    );
                                }
                            });
                        }
                    });

                    // Flush any pending text requested before TTS was ready
                    if (pendingSpeakText != null) {
                        final String queuedText = pendingSpeakText;
                        final String queuedLang = pendingSpeakLang;
                        pendingSpeakText = null;
                        pendingSpeakLang = null;
                        runOnUiThread(() -> speakText(queuedText, queuedLang));
                    }
                } else {
                    isTtsInitialized = false;
                }
            });
        } catch (Exception e) {
            isTtsInitialized = false;
        }
    }

    private void applyTtsLanguage(String lang) {
        if (textToSpeech == null) return;
        Locale targetLocale;
        if ("hi".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("hi", "IN");
        } else if ("ta".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("ta", "IN");
        } else if ("te".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("te", "IN");
        } else if ("ml".equalsIgnoreCase(lang)) {
            targetLocale = new Locale("ml", "IN");
        } else {
            targetLocale = Locale.ENGLISH;
        }

        try {
            int result = textToSpeech.setLanguage(targetLocale);
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to Indian English or standard English
                int fallbackResult = textToSpeech.setLanguage(new Locale("en", "IN"));
                if (fallbackResult == TextToSpeech.LANG_MISSING_DATA || fallbackResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(Locale.ENGLISH);
                }
            }
        } catch (Exception ignored) {
            try {
                textToSpeech.setLanguage(Locale.ENGLISH);
            } catch (Exception ignored2) {}
        }
    }

    public void speakText(String text, String lang) {
        if (text == null || text.trim().isEmpty()) return;

        if (!isTtsInitialized || textToSpeech == null) {
            pendingSpeakText = text;
            pendingSpeakLang = lang;
            initTextToSpeech();
            return;
        }

        try {
            applyTtsLanguage(lang);
            textToSpeech.setPitch(1.0f);
            textToSpeech.setSpeechRate(0.95f);

            Bundle params = new Bundle();
            params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);

            String utteranceId = "Saathi_" + System.currentTimeMillis();
            textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId);
        } catch (Exception e) {
            Toast.makeText(this, "Voice error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    public void stopSpeech() {
        if (textToSpeech != null) {
            textToSpeech.stop();
        }
    }

    public boolean isTtsReady() {
        return isTtsInitialized && textToSpeech != null;
    }

    /**
     * Launch Speech-to-Text with full Android 10+ runtime permission safety
     */
    public void startVoiceRecognition(String lang) {
        // Ensure RECORD_AUDIO permission is granted before launching speech intent
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingVoiceLang = lang;
            ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION_REQUEST_CODE);
            return;
        }

        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                if ("hi".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN");
                } else if ("ta".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ta-IN");
                } else if ("te".equalsIgnoreCase(lang)) {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "te-IN");
                } else {
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                }
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Saathi AI…");
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                startActivityForResult(intent, SPEECH_REQUEST_CODE);
            } catch (Exception e) {
                notifySpeechResult("");
                Toast.makeText(this, "Voice recognition not available. Please install Google Speech Services.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void notifySpeechResult(String spokenText) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().post(() -> {
                String safeText = spokenText == null ? "" : spokenText.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
                getBridge().getWebView().evaluateJavascript(
                    "window.__onNativeSpeechResult && window.__onNativeSpeechResult('" + safeText + "');",
                    null
                );
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            for (int i = 0; i < permissions.length; i++) {
                if (Manifest.permission.RECORD_AUDIO.equals(permissions[i]) && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    if (pendingVoiceLang != null) {
                        String lang = pendingVoiceLang;
                        pendingVoiceLang = null;
                        startVoiceRecognition(lang);
                    }
                }
            }
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SPEECH_REQUEST_CODE) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (results != null && !results.isEmpty()) {
                    notifySpeechResult(results.get(0));
                } else {
                    notifySpeechResult("");
                }
            } else {
                // Cancelled or no speech detected: notify frontend so isListening resets cleanly
                notifySpeechResult("");
            }
        } else if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (mFilePathCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    }
                }
                mFilePathCallback.onReceiveValue(results);
                mFilePathCallback = null;
            }
        } else if (requestCode == GALLERY_PICK_REQUEST_CODE) {
            if (resultCode == RESULT_OK && data != null) {
                Uri imageUri = data.getData();
                if (imageUri != null) {
                    new Thread(() -> {
                        try {
                            java.io.InputStream inputStream = getContentResolver().openInputStream(imageUri);
                            if (inputStream != null) {
                                java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
                                int nRead;
                                byte[] chunk = new byte[16384];
                                while ((nRead = inputStream.read(chunk, 0, chunk.length)) != -1) {
                                    buffer.write(chunk, 0, nRead);
                                }
                                buffer.flush();
                                byte[] imageBytes = buffer.toByteArray();
                                inputStream.close();
                                String base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP);
                                String mimeType = getContentResolver().getType(imageUri);
                                if (mimeType == null) mimeType = "image/jpeg";
                                final String dataUrl = "data:" + mimeType + ";base64," + base64;
                                runOnUiThread(() -> {
                                    if (getBridge() != null && getBridge().getWebView() != null) {
                                        getBridge().getWebView().evaluateJavascript(
                                            "window.__onNativeGalleryImage && window.__onNativeGalleryImage('" + dataUrl + "');", null
                                        );
                                    }
                                });
                            }
                        } catch (Exception e) {
                            runOnUiThread(() -> Toast.makeText(this, "Could not load selected photo", Toast.LENGTH_SHORT).show());
                        }
                    }).start();
                }
            }
        }
    }

    public void saveBase64ToDownloads(String base64Data, String filename, String mimeType) {
        if (filename == null || filename.trim().isEmpty()) {
            filename = "RenoPay_Document_" + System.currentTimeMillis();
        }
        if (mimeType == null || mimeType.trim().isEmpty()) {
            if (filename.toLowerCase().endsWith(".png")) {
                mimeType = "image/png";
            } else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) {
                mimeType = "image/jpeg";
            } else {
                mimeType = "application/pdf";
            }
        }

        if (mimeType.contains("png") && !filename.toLowerCase().endsWith(".png")) {
            filename = filename + ".png";
        } else if ((mimeType.contains("jpg") || mimeType.contains("jpeg")) && !filename.toLowerCase().endsWith(".jpg")) {
            filename = filename + ".jpg";
        } else if (mimeType.contains("pdf") && !filename.toLowerCase().endsWith(".pdf")) {
            filename = filename + ".pdf";
        }

        final String finalFilename = filename;
        final String finalMimeType = mimeType.split(";")[0].trim();
        final String rawBase64Input = base64Data;

        new Thread(() -> {
            try {
                String cleanBase64 = rawBase64Input;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }
                cleanBase64 = cleanBase64.replaceAll("\\s+", "");
                byte[] fileBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

                boolean mediaStoreSuccess = false;

                // Save directly to Phone Downloads via MediaStore (Android 10+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalFilename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, finalMimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/RenoPay");
                        values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                        ContentResolver resolver = getContentResolver();
                        Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                        Uri itemUri = null;
                        try {
                            itemUri = resolver.insert(collection, values);
                        } catch (Exception ex) {
                            // Some devices reject custom subdirectories; fallback to root Downloads
                            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                            itemUri = resolver.insert(collection, values);
                        }

                        if (itemUri != null) {
                            try (OutputStream os = resolver.openOutputStream(itemUri)) {
                                if (os != null) {
                                    os.write(fileBytes);
                                    os.flush();
                                }
                            }
                            values.clear();
                            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                            resolver.update(itemUri, values, null, null);
                            mediaStoreSuccess = true;
                        }
                    } catch (Exception msEx) {
                        Log.w("RenoPay", "MediaStore download failed, using file fallback: " + msEx.getMessage());
                    }
                }

                if (!mediaStoreSuccess) {
                    // Public Downloads folder fallback
                    File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (publicDownloads != null && (publicDownloads.exists() || publicDownloads.mkdirs())) {
                        File targetFile = new File(publicDownloads, finalFilename);
                        try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                            fos.write(fileBytes);
                            fos.flush();
                        }
                        sendBroadcast(new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE, Uri.fromFile(targetFile)));
                    }
                }

                // Also keep local copy for internal app sharing / preview
                File appDownloads = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (appDownloads != null && !appDownloads.exists()) {
                    appDownloads.mkdirs();
                }
                File localFile = new File(appDownloads, finalFilename);
                try (FileOutputStream fos = new FileOutputStream(localFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    localFile
                );

                runOnUiThread(() -> {
                    Toast.makeText(this, "✅ Saved to Phone Downloads: " + finalFilename, Toast.LENGTH_LONG).show();
                    try {
                        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                        viewIntent.setDataAndType(contentUri, finalMimeType);
                        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(Intent.createChooser(viewIntent, "Open " + finalFilename));
                    } catch (Exception ex) {
                        // Viewer app may not be present
                    }
                });

            } catch (Exception e) {
                final String errorMsg = e.getMessage();
                runOnUiThread(() -> {
                    Toast.makeText(this, "Could not save file: " + errorMsg, Toast.LENGTH_LONG).show();
                });
            }
        }).start();
    }

    private void setupJavascriptInterfaces() {
        int[] delays = {0, 300, 800, 1500};
        for (int delay : delays) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        WebView wv = getBridge().getWebView();
                        wv.addJavascriptInterface(new AndroidDownloaderInterface(MainActivity.this), "AndroidDownloader");
                        wv.addJavascriptInterface(new AndroidTTSInterface(MainActivity.this), "AndroidTTS");
                        wv.addJavascriptInterface(new AndroidSTTInterface(MainActivity.this), "AndroidSTT");
                        wv.addJavascriptInterface(new AndroidGalleryInterface(MainActivity.this), "AndroidGallery");

                        // Inject Capacitor Plugin shim if window.AndroidTTS is not yet set
                        wv.evaluateJavascript(
                            "if (!window.AndroidTTS && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.RenoTTS) {" +
                            "  window.AndroidTTS = {" +
                            "    speak: function(t, l) { window.Capacitor.Plugins.RenoTTS.speak({text: t, lang: l}); }," +
                            "    stop: function() { window.Capacitor.Plugins.RenoTTS.stop(); }," +
                            "    isAvailable: function() { return true; }" +
                            "  };" +
                            "}" +
                            "window.__isRenoPayAndroid = true;", null
                        );
                    }
                } catch (Exception ignored) {}
            }, delay);
        }
    }

    @CapacitorPlugin(name = "RenoTTS")
    public static class RenoTTSPlugin extends Plugin {
        @PluginMethod
        public void speak(PluginCall call) {
            String text = call.getString("text");
            String lang = call.getString("lang", "en");
            MainActivity activity = (MainActivity) getActivity();
            if (activity != null && text != null) {
                activity.runOnUiThread(() -> activity.speakText(text, lang));
                call.resolve();
            } else {
                call.reject("Activity or text missing");
            }
        }

        @PluginMethod
        public void stop(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            if (activity != null) {
                activity.runOnUiThread(activity::stopSpeech);
                call.resolve();
            } else {
                call.reject("Activity missing");
            }
        }

        @PluginMethod
        public void isAvailable(PluginCall call) {
            MainActivity activity = (MainActivity) getActivity();
            JSObject ret = new JSObject();
            ret.put("available", activity != null && activity.isTtsReady());
            call.resolve(ret);
        }
    }

    public static class AndroidDownloaderInterface {
        private final MainActivity activity;

        public AndroidDownloaderInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            activity.saveBase64ToDownloads(base64Data, filename, mimeType);
        }
    }

    public static class AndroidTTSInterface {
        private final MainActivity activity;

        public AndroidTTSInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void speak(String text, String lang) {
            activity.runOnUiThread(() -> activity.speakText(text, lang));
        }

        @JavascriptInterface
        public void stop() {
            activity.runOnUiThread(activity::stopSpeech);
        }

        @JavascriptInterface
        public boolean isAvailable() {
            return activity.isTtsReady();
        }
    }

    public static class AndroidSTTInterface {
        private final MainActivity activity;

        public AndroidSTTInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void startListening(String lang) {
            activity.startVoiceRecognition(lang);
        }

        @JavascriptInterface
        public void stopListening() {
            activity.runOnUiThread(activity::stopSpeech);
        }
    }

    public void openNativeGallery() {
        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
                intent.setType("image/*");
                startActivityForResult(Intent.createChooser(intent, "Select QR Code Image"), GALLERY_PICK_REQUEST_CODE);
            } catch (Exception e) {
                try {
                    Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("image/*");
                    startActivityForResult(Intent.createChooser(intent, "Select QR Code Image"), GALLERY_PICK_REQUEST_CODE);
                } catch (Exception ex) {
                    Toast.makeText(this, "Could not open gallery: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    public static class AndroidGalleryInterface {
        private final MainActivity activity;

        public AndroidGalleryInterface(MainActivity activity) {
            this.activity = activity;
        }

        @JavascriptInterface
        public void openGallery() {
            activity.openNativeGallery();
        }
    }

    @Override
    public void onDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.onDestroy();
    }
}
