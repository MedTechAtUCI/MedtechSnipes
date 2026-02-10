import { useState, useEffect } from 'react';
import { useFonts } from 'expo-font';
import { StyleSheet, View, ScrollView, Image, Dimensions, Alert, Platform } from 'react-native';
import { Text, Button, Card, Provider as PaperProvider, MD3LightTheme, Modal, Portal, List, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const players = [
  {name: "Other", image: require("./assets/medtech_snipes_logo.png")},
  {name: "Ashley Yee", image: require("./assets/Ashley_Yee.jpg")}, 
  {name: "Anish Venkatesalu", image: require("./assets/anish.jpg")}, 
  {name:"Brian Sar", image: require("./assets/BrianSar.png")}, 
  {name: "Ian Pierre Van Der Linde", image: require("./assets/IanLinde.jpeg")}, 
  {name: "Emma Chen", image: require("./assets/EmmaChen.jpeg")}, 
  {name: "Kierann Chong", image: require("./assets/KierannChong.jpg")}, 
  {name: "Jeremiah Lillion", image: require("./assets/JeremiahLillion.jpg")}, 
  {name: "Rigel De Souza", image: require("./assets/RigelDeSouza.jpg")}, 
  {name:"Logan Mifflin", image: require("./assets/LoganMifflin.png")}, 
  {name: "Siddharth Sundar", image: require("./assets/SiddharthSundar.jpg")}
]

const screenWidth = Dimensions.get('window').width;
const imageSize = (screenWidth - 60) / 2; // 60 accounts for screen padding and gaps
const medtechEndpoint = "https://script.google.com/macros/s/AKfycbyhcYUXH6LJLcc3ZcWNeBnVokX31e9FhLP_fW7SzAGrKq8B6STNDzia77hr4iorL5nMIA/exec";
const isWeb = Platform.OS === 'web'


function alert(title, body) {
  if (isWeb) {
    window.alert(title + ":\n\t" + body);
  } else {
    Alert.alert(title, body);
  }
}

const PlayerPicker = ({ visible, onHide, onSelect, title, playersList }) => (
  <Portal>
    <Modal visible={visible} onDismiss={onHide} contentContainerStyle={styles.modalStyle}>
      <Text variant="headlineSmall" style={styles.modalTitle}>{title}</Text>
      <ScrollView style={{ maxHeight: 400 }}>
        {playersList.map((player, index) => (
          <List.Item
            key={index}
            title={player.name}
            onPress={() => {
              onSelect(index);
              onHide();
            }}
            left={() => (
              <Avatar.Image 
                size={48} 
                source={player.image} 
                key={player.name}
                style={{ backgroundColor: '#E1E1E1' }}
              />
            )}
            style={styles.listItem}
          />
        ))}
      </ScrollView>
      <Button onPress={onHide} style={{marginTop: 10}}>Cancel</Button>
    </Modal>
  </Portal>
);

export default function App() {
  const [fontsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  const [sniperNameId, setSniperNameId] = useState(null);
  const [targetNameId, setTargetNameId] = useState(0);
  const [visibleSniper, setVisibleSniper] = useState(false);
  const [visibleTarget, setVisibleTarget] = useState(false);

  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadName = async () => {
      try {
        const savedNameIndex = await AsyncStorage.getItem('@user_index');
        if (savedNameIndex !== null) {
          setSniperNameId(savedNameIndex);
        } else {
          setVisibleSniper(true); // Force name entry if new user
        }
      } catch (e) {
        console.error("Failed to load name");
      }
    }

    loadName();

    if (isWeb) {
      players.forEach((player) => {
        // Create a hidden image object to force the browser to cache the file
        const img = new window.Image();
        // Handle the .default issue automatically
        const src = typeof player.image === 'object' ? (player.image.default || player.image) : player.image;
        img.src = src;
      });
    }
  }, []);

  const pickImage = async () => {
    if (sniperNameId === null) {
      alert("Name Required", "Please set your name before sniping!");
      return;
    }

    if (visibleSniper) {
      alert("Editing Name", "Please finish editing your name!");
      return;
    }

    if (!isWeb) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        alert("Lacking Image Permissions", "Allow access to photo selection, or else you cant upload your photos!");
      }
    }

    // Request permission and open library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      selectionLimit: 5,
      allowsMultipleSelection: true, // Allows selection of multiple images
      quality: 0.5,
    });

    if (!result.canceled) {
      if (result.assets.length > 5) {
        alert(
          "Too many snipes!", 
          "Please select a maximum of 5 images at once to ensure a successful upload."
        );
        return; 
      }

      setImages(result.assets.map(asset => asset.uri));
    }
  };

  // 1. Helper to convert Blob URI to Base64 (The PWA Way), else do native app way
  const getBase64 = async (uri) => {
    if (isWeb) {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Remove header
        reader.onerror = error => reject(error);
        reader.readAsDataURL(blob);
      });
    } else {
        try {
          // 1. Create a File object from the asset URI
          const file = new File(uri);
          
          // 2. Use the new .base64() method (it's asynchronous)
          const base64String = await file.base64();
          
          return base64String;
        } catch (e) {
          console.error("Error reading image:", e);
          return null;
        }
    }
  };

  const uploadImages = async () => {
    if (images.length === 0) return;

    setUploading(true);

    try {
      const base64Array = await Promise.all(images.map(async (uri) => getBase64(uri)));

      // Prepare the JSON object
      const payload = {
        magic: "MEDTECH_SNIPE_UPLOAD_MAGIC",
        sniperNameId: sniperNameId,
        targetNameId: targetNameId,
        timestamp: new Date().toISOString(),
        images: base64Array,
      };

      // Sending to a dummy URL (JSONPlaceholder or a webhook site)
      const response = await fetch(medtechEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      const result = await response.json();

      if (result.status === "success") {
        alert("Success!", `Snipes have been uploaded!!!`);
        setImages([]); // Clear images after successful upload
      } else {
        alert("Upload Failed", `Issue with images sent to Medtech@UCI!!!\n${result.message}`);//response.message}`);
      }
    } catch (error) {
      alert("Other Error", `Could not send to Medtech@UCI!!!\n${error}`);
    } finally {
      setUploading(false);
    }
  };

  if (!fontsLoaded) {
    return null; 
  }

  return (
    <PaperProvider theme={MD3LightTheme}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header Section */}
        <Text variant="displayMedium" style={styles.header}>
          Medtech Snipes
        </Text>

        {/* Rules Section */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="bodyLarge" style={styles.introText}>
              Upload IRL snipes of fellow Medtech@UCI members here for end-of-quarter points!
            </Text>
            
            <Text variant="titleMedium" style={styles.ruleTitle}>Rules:</Text>
            
            <View style={styles.ruleItem}>
              <Text variant="bodyMedium">
                1. Each member can snipe all other member only once per day for points.
              </Text>
              <Text variant="bodySmall" style={styles.tabbedItem}>
                e.g. Member A can snipe each individual member B, C, D, ... once in the same day, and must wait until the next day to do so again if they want points for it.
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text variant="bodyMedium">
                2. That's it! Have fun!!!
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Selection Section */}
        <Card style={styles.selectionCard}>
          <Card.Content>
            <Text variant="labelLarge" style={styles.label}>I AM...</Text>
            <Button 
              mode="outlined" 
              onPress={() => setVisibleSniper(true)} 
              style={styles.pickerTrigger}
              contentStyle={styles.pickerTriggerContent}
              icon="account"
            >
              {sniperNameId !== null ? players[sniperNameId].name : "Select Your Name"}
            </Button>

            <View style={{ height: 15 }} />

            <Text variant="labelLarge" style={styles.label}>I SNIPED...</Text>
            <Button 
              mode="outlined" 
              onPress={() => setVisibleTarget(true)} 
              style={styles.pickerTrigger}
              contentStyle={styles.pickerTriggerContent}
              icon="target"
            >
              {players[targetNameId].name}
            </Button>
          </Card.Content>
        </Card>

        {/* Picker Modals */}
        <PlayerPicker 
          visible={visibleSniper} 
          onHide={() => setVisibleSniper(false)} 
          playersList={players}
          title="Who are you?"
          onSelect={async (index) => {
            setSniperNameId(index);
            await AsyncStorage.setItem('@user_index', index.toString());
          }}
        />

        <PlayerPicker 
          visible={visibleTarget} 
          onHide={() => setVisibleTarget(false)} 
          playersList={players}
          title="Who did you catch?"
          onSelect={(index) => setTargetNameId(index)}
        />

        {/* 1. Selection Button */}
        <Button 
          icon="camera" 
          mode="contained" 
          onPress={pickImage}
          style={styles.button}
          contentStyle={styles.buttonContent}
          buttonColor="#b64ffc"
        >
          Select Snipes to Upload
        </Button>

        {/* 2. Restored Upload Button */}
        {images.length > 0 && (
          <Button 
            icon="cloud-upload" 
            mode="contained" 
            onPress={uploadImages} 
            loading={uploading}
            // Button is disabled if: 
            // - Too many images (>5)
            // - Currently uploading
            // - No sniper selected (sniperNameId is null or -1)
            disabled={images.length > 5 || uploading || sniperNameId === null || sniperNameId === -1}
            style={styles.uploadButton}
            buttonColor="#50bbfd"
          >
            {sniperNameId === null || sniperNameId === -1 
              ? "Select Your Name Above First" 
              : `Upload ${images.length} Snipe${images.length > 1 ? 's' : ''}`}
          </Button>
        )}

        {/* Bottom Image Viewer Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.previewLabel}>
            {images.length > 5 
              ? "⚠️ Limit exceeded (Max 5)" 
              :images.length > 0 ? `Selected Snipes (${images.length})` : 'No images selected'}
          </Text>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
          >
            {images.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.previewImage} />
            ))}
          </ScrollView>
        </View>

      </ScrollView>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
    userSelect: 'none', // Prevents text selection highlighting
    WebkitUserSelect: 'none',
    touchAction: 'manipulation', // Prevents double-tap zoom
  },
  header: {
    fontWeight: '900',
    textAlign: 'center',
    color: '#40b5fd',
    marginBottom: 20,
  },
  nameContainer: { marginBottom: 20, minHeight: 60, justifyContent: 'center' },
  nameInputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, marginRight: 10, backgroundColor: '#fff' },
  saveBtn: { borderRadius: 8 },
  nameDisplayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#e3f2fd', borderRadius: 30, paddingLeft: 15 },
  welcomeText: { fontSize: 14, color: '#0064a4' },
  boldName: { fontWeight: 'bold' },
  card: {
    marginBottom: 25,
    backgroundColor: '#fff',
  },
  uploadButton: { borderRadius: 12, paddingVertical: 4 },
  introText: {
    marginBottom: 15,
    fontStyle: 'italic',
    fontWeight: 'bold',
    color: '#555',
  },
  ruleTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ruleItem: {
    marginBottom: 20,
    paddingLeft: 5,
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 8
  },
  buttonContent: {
    paddingVertical: 8,
  },
  bottomSection: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  tabbedItem: {
    paddingHorizontal: 24
  },
  previewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    justifyContent: 'center',
  },
  previewImage: {
    width: imageSize,
    height: imageSize,
    borderRadius: 12,
    marginHorizontal: 4, // Space between images
    backgroundColor: '#eee',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginLeft: 24,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  scrollContainer: {
    paddingHorizontal: 20, // Aligns first image with text
  },
  modalStyle: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 20,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: 'bold',
    color: '#40b5fd'
  },
  listItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8
  },
  selectionCard: {
    marginBottom: 20,
    backgroundColor: '#fff',
    elevation: 2
  },
  label: {
    color: '#777',
    marginBottom: 5,
    marginLeft: 5
  },
  pickerTrigger: {
    borderRadius: 10,
    borderWidth: 1,
  },
  pickerTriggerContent: {
    height: 50,
    justifyContent: 'flex-start'
  }
});