import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SharingOptions } from 'expo-sharing';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ShareExample = {
  id: string;
  title: string;
  sourceUrl: string;
  localName: string;
  options: SharingOptions;
  note: string;
};

type ShareSection = {
  title: string;
  examples: ShareExample[];
};

const EXPO_RAW = 'https://raw.githubusercontent.com/expo/expo/main';
const REACT_NATIVE_RAW = 'https://raw.githubusercontent.com/facebook/react-native/main';

const sources = {
  extensionlessJpeg:
    'https://useful-cow-483.convex.cloud/api/storage/042a5375-85f6-4351-b950-bb3b65b7d6a3',
  jpeg: `${EXPO_RAW}/apps/test-suite/assets/example_image_1.jpg`,
  png: `${EXPO_RAW}/apps/bare-expo/assets/icon.png`,
  gif: `${REACT_NATIVE_RAW}/packages/rn-tester/js/assets/tumblr_mfqekpMktw1rn90umo1_500.gif`,
  webp: `${EXPO_RAW}/docs/public/static/thumbnails/sedaily-01.webp`,
  avif: `${EXPO_RAW}/docs/public/static/images/atlas/atlas-module.avif`,
  svg: `${EXPO_RAW}/apps/test-suite/assets/expo.svg`,
  mp4: `${EXPO_RAW}/apps/native-component-list/assets/expo-blob/performance-test-video-1mb.mp4`,
  mov: `${EXPO_RAW}/apps/native-component-list/assets/videos/tola_seek_optimized.mov`,
  webm: `${EXPO_RAW}/apps/test-suite/assets/unsupported_bunny.webm`,
  pdf: `${EXPO_RAW}/packages/@expo/image-utils/src/__tests__/assets/icon.pdf`,
  text: `${EXPO_RAW}/fastlane/metadata/en-US/description.txt`,
  json: `${EXPO_RAW}/package.json`,
  mp3: `${EXPO_RAW}/apps/test-suite/assets/LLizard.mp3`,
};

const sections: ShareSection[] = [
  {
    title: 'Images',
    examples: [
      {
        id: 'jpeg-source-and-local-no-extension',
        title: 'JPEG · no extensions',
        sourceUrl: sources.extensionlessJpeg,
        localName: 'jpeg-no-extension',
        options: { mimeType: 'image/jpeg' },
        note: 'Source URL and cached file both have no extension',
      },
      {
        id: 'jpeg-correct-extension',
        title: 'JPEG · matching .jpg',
        sourceUrl: sources.jpeg,
        localName: 'photo.jpg',
        options: {},
        note: 'Existing extension already matches the MIME type',
      },
      {
        id: 'jpeg-conflicting-extension',
        title: 'JPEG · conflicting .pdf',
        sourceUrl: sources.jpeg,
        localName: 'photo.pdf',
        options: { mimeType: 'image/jpeg' },
        note: 'Declared JPEG should win over the .pdf filename',
      },
      {
        id: 'png-correct-extension',
        title: 'PNG · matching .png',
        sourceUrl: sources.png,
        localName: 'icon.png',
        options: { mimeType: 'image/png' },
        note: 'Ordinary URL-based sharing path',
      },
      {
        id: 'png-no-extension-uti',
        title: 'PNG · no extension + UTI',
        sourceUrl: sources.png,
        localName: 'png-with-uti',
        options: { UTI: 'public.png' },
        note: 'Uses a UTI instead of a MIME type',
      },
      {
        id: 'gif-no-extension',
        title: 'Animated GIF · no extension',
        sourceUrl: sources.gif,
        localName: 'animated-gif',
        options: { mimeType: 'image/gif' },
        note: 'Checks animated image preview and delivery',
      },
      {
        id: 'webp-correct-extension',
        title: 'WebP · matching .webp',
        sourceUrl: sources.webp,
        localName: 'thumbnail.webp',
        options: {},
        note: 'Modern image format with a matching filename',
      },
      {
        id: 'avif-no-extension',
        title: 'AVIF · no extension',
        sourceUrl: sources.avif,
        localName: 'avif-no-extension',
        options: { mimeType: 'image/avif' },
        note: 'Modern image format requiring declared type metadata',
      },
      {
        id: 'svg-correct-extension',
        title: 'SVG · matching .svg',
        sourceUrl: sources.svg,
        localName: 'expo.svg',
        options: {},
        note: 'Vector image file',
      },
    ],
  },
  {
    title: 'Video',
    examples: [
      {
        id: 'mp4-correct-extension',
        title: 'MP4 · matching .mp4',
        sourceUrl: sources.mp4,
        localName: 'video.mp4',
        options: {},
        note: 'Ordinary MP4 file',
      },
      {
        id: 'mp4-no-extension',
        title: 'MP4 · no extension',
        sourceUrl: sources.mp4,
        localName: 'mp4-no-extension',
        options: { mimeType: 'video/mp4' },
        note: 'Video provider must supply type, title, and preview',
      },
      {
        id: 'mp4-conflicting-extension',
        title: 'MP4 · conflicting .jpg',
        sourceUrl: sources.mp4,
        localName: 'video.jpg',
        options: { mimeType: 'video/mp4' },
        note: 'Declared video type should win over .jpg',
      },
      {
        id: 'quicktime-uti-no-extension',
        title: 'QuickTime · no extension + UTI',
        sourceUrl: sources.mov,
        localName: 'quicktime-no-extension',
        options: { UTI: 'com.apple.quicktime-movie' },
        note: 'Uses the native QuickTime UTI',
      },
      {
        id: 'webm-correct-extension',
        title: 'WebM · matching .webm',
        sourceUrl: sources.webm,
        localName: 'bunny.webm',
        options: {},
        note: 'Format support may depend on the receiving activity',
      },
    ],
  },
  {
    title: 'Documents and audio',
    examples: [
      {
        id: 'pdf-correct-extension',
        title: 'PDF · matching .pdf',
        sourceUrl: sources.pdf,
        localName: 'document.pdf',
        options: { mimeType: 'application/pdf' },
        note: 'Ordinary PDF file',
      },
      {
        id: 'pdf-no-extension-uti',
        title: 'PDF · no extension + UTI',
        sourceUrl: sources.pdf,
        localName: 'pdf-no-extension',
        options: { UTI: 'com.adobe.pdf' },
        note: 'Checks Quick Look preview for an extensionless PDF',
      },
      {
        id: 'text-no-extension',
        title: 'Plain text · no extension',
        sourceUrl: sources.text,
        localName: 'plain-text-no-extension',
        options: { mimeType: 'text/plain' },
        note: 'Text document without a filename extension',
      },
      {
        id: 'json-correct-extension',
        title: 'JSON · matching .json',
        sourceUrl: sources.json,
        localName: 'package.json',
        options: { mimeType: 'application/json' },
        note: 'Structured text document',
      },
      {
        id: 'mp3-no-extension',
        title: 'MP3 · no extension',
        sourceUrl: sources.mp3,
        localName: 'audio-no-extension',
        options: { mimeType: 'audio/mpeg' },
        note: 'Audio file requiring a suggested extension',
      },
      {
        id: 'generic-binary',
        title: 'Generic binary · .bin',
        sourceUrl: sources.json,
        localName: 'generic.bin',
        options: { mimeType: 'application/octet-stream' },
        note: 'Type has no more specific canonical extension',
      },
    ],
  },
];

function declaredType(options: SharingOptions): string {
  return options.UTI ?? options.mimeType ?? 'not declared - auto-derived from filename';
}

export default function SharingScreen() {
  const [activeExampleId, setActiveExampleId] = useState<string>();
  const [status, setStatus] = useState('Choose a file to download and share.');

  const handleShare = async (example: ShareExample) => {
    if (!FileSystem.cacheDirectory) {
      console.error('File system unavailable. A cache directory is required to share files.');
      return;
    }

    setActiveExampleId(example.id);
    setStatus(`Downloading ${example.title}…`);

    const destinationUrl = `${FileSystem.cacheDirectory}expo-sharing-${example.localName}`;

    try {
      await FileSystem.deleteAsync(destinationUrl, { idempotent: true });
      const result = await FileSystem.downloadAsync(example.sourceUrl, destinationUrl, {
        sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(`Download returned HTTP ${result.status}.`);
      }

      setStatus(`Sharing ${example.localName} as ${declaredType(example.options)}…`);
      await Sharing.shareAsync(result.uri, example.options);
      setStatus(`Finished: ${example.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed: ${example.title}`);
      console.error('Unable to share file: ' + message);
    } finally {
      setActiveExampleId(undefined);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.screen}>
      <Text style={styles.title}>Sharing file matrix</Text>
      <Text style={styles.intro}>
        Each example is downloaded to the cache using the local filename shown, then shared with its
        declared MIME type or UTI.
      </Text>
      <View style={styles.statusCard}>
        {activeExampleId ? <ActivityIndicator size="small" color="#0a7ea4" /> : null}
        <Text style={styles.status}>{status}</Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.examples.map((example) => {
            const isActive = activeExampleId === example.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share ${example.title}`}
                disabled={activeExampleId !== undefined}
                key={example.id}
                onPress={() => handleShare(example)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && styles.cardPressed,
                  activeExampleId !== undefined && !isActive && styles.cardDisabled,
                ]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{example.title}</Text>
                  {isActive ? <ActivityIndicator size="small" color="#0a7ea4" /> : null}
                </View>
                <Text style={styles.type}>{declaredType(example.options)}</Text>
                <Text style={styles.filename}>Local: {example.localName}</Text>
                <Text numberOfLines={1} style={styles.source}>
                  Source: {example.sourceUrl}
                </Text>
                <Text style={styles.note}>{example.note}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

SharingScreen.navigationOptions = {
  title: 'Sharing',
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  content: {
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 48,
  },
  title: {
    color: '#111',
    fontSize: 28,
    fontWeight: '700',
  },
  intro: {
    color: '#555',
    fontSize: 15,
    lineHeight: 21,
  },
  statusCard: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#e5f5fb',
  },
  status: {
    flex: 1,
    color: '#07566f',
    fontSize: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    marginTop: 4,
    color: '#111',
    fontSize: 20,
    fontWeight: '700',
  },
  card: {
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7d7dc',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#fff',
  },
  cardPressed: {
    opacity: 0.65,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  cardHeader: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
  type: {
    color: '#0a7ea4',
    fontSize: 13,
    fontWeight: '600',
  },
  filename: {
    color: '#333',
    fontFamily: 'Menlo',
    fontSize: 12,
  },
  source: {
    color: '#707078',
    fontSize: 11,
  },
  note: {
    color: '#707078',
    fontSize: 13,
    lineHeight: 18,
  },
});
