package com.rishabh.renopay;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int SPEECH_REQUEST_CODE = 1002;

    private TextToSpeech textToSpeech;
    private boolean isTtsInitialized = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestAppPermissions();
        initTextToSpeech();
        setupJavascriptInterfaces();
    }

    private void checkAndRequestAppPermissions() {
        String[] permissions = new String[]{
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        };
        boolean needsRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needsRequest = true;
                break;
            }
        }
        if (needsRequest) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }
    }

    private void initTextToSpeech() {
        textToSpeech = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                isTtsInitialized = true;
                textToSpeech.setLanguage(new Locale("hi", "IN"));
            }
        });
    }

    private void setupJavascriptInterfaces() {
        // Native PDF and file downloader
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void saveBase64File(String base64Data, String filename, String mimeType) {
                try {
                    byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File file = new File(downloadsDir, filename);
                    FileOutputStream fos = new FileOutputStream(file);
                    fos.write(fileBytes);
                    fos.flush();
                    fos.close();

                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "PDF Downloaded: " + filename, Toast.LENGTH_LONG).show());

                    Uri fileUri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        file
                    );

                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(fileUri, mimeType != null ? mimeType : "application/pdf");
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(Intent.createChooser(intent, "Open " + filename));
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Could not save PDF: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            }
        }, "AndroidDownloader");

        // Native Saathi AI Voice (Text to Speech)
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void speak(String text, String lang) {
                if (textToSpeech != null && isTtsInitialized) {
                    if ("hi".equalsIgnoreCase(lang)) {
                        textToSpeech.setLanguage(new Locale("hi", "IN"));
                    } else if ("ta".equalsIgnoreCase(lang)) {
                        textToSpeech.setLanguage(new Locale("ta", "IN"));
                    } else if ("te".equalsIgnoreCase(lang)) {
                        textToSpeech.setLanguage(new Locale("te", "IN"));
                    } else {
                        textToSpeech.setLanguage(Locale.ENGLISH);
                    }
                    textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "SaathiTTS");
                }
            }

            @JavascriptInterface
            public void stop() {
                if (textToSpeech != null) {
                    textToSpeech.stop();
                }
            }

            @JavascriptInterface
            public boolean isAvailable() {
                return isTtsInitialized;
            }
        }, "AndroidTTS");

        // Native Saathi AI Speech-to-Text (Voice input via Google Speech Recognizer)
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void startListening(String lang) {
                runOnUiThread(() -> {
                    try {
                        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                        if ("hi".equalsIgnoreCase(lang)) {
                            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hi-IN");
                        } else {
                            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN");
                        }
                        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Saathi AI…");
                        startActivityForResult(intent, SPEECH_REQUEST_CODE);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Voice recognition not available on this device", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "AndroidSTT");
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SPEECH_REQUEST_CODE && resultCode == RESULT_OK && data != null) {
            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results != null && !results.isEmpty()) {
                String spokenText = results.get(0).replace("'", "\\'").replace("\n", " ");
                getBridge().getWebView().post(() -> {
                    getBridge().getWebView().evaluateJavascript("window.__onNativeSpeechResult && window.__onNativeSpeechResult('" + spokenText + "');", null);
                });
            }
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
