import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, query, getDocs, where, updateDoc, deleteDoc} from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase/firebaseConfig';

const EnviarReferencia = () => {
    const { state } = useLocation();
    const { imagenUrl} = state;
    
    const imagenQuery = query(collection(db, 'imagen'), where('imagenUrl', '==', imagenUrl));
    const navigate = useNavigate();
    const [newImage, setNewImage] = useState(null);
    const [descripcion, setDescripcion] = useState("");

    useEffect(() => {
        // Realiza la consulta para obtener la descripción y etiquetas solo cuando se monta el componente
        const fetchData = async () => {
          try {
            const querySnapshot = await getDocs(imagenQuery);
            if (!querySnapshot.empty) {
              const data = querySnapshot.docs[0].data();
            } 
          } catch (error) {
            console.error("Error al obtener datos:", error);
          }
        };
        fetchData();
    }, []);

    const handleCambiarClick = () => {
        const fileInput = document.getElementById('imageInput');
        fileInput.click();
      };
    
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewImage(file);
        }
    };

    const handleVerInfo = (e) => {

    }

    const handleEnviarRef = (e) => {

    }

    console.log("llegando",imagenUrl);
    
    return (
        <div className="info-container">
          <form className='formTopOA'>
            <div>
              <button className="botonFijo" onClick={() => navigate('/galeriaCliente')}>
                Galería
              </button>
              <button className="botonOA" onClick={() => navigate('/AccederTiendaClienteController')}>
                Tienda
              </button>      
            </div>
          </form>
    
          <form className="formImagenInfo">
            <div className="imagen-container-info">
              {newImage ? (
                <img src={URL.createObjectURL(newImage)} alt="Nueva Imagen" />
              ) : (
                imagenUrl ? (
                  <img src={imagenUrl} alt="Imagen Actual" />
                ) : (
                  <p>No se ha proporcionado una URL de imagen válida.</p>
                )
              )}
            </div>
            
            <button className="buttons" type="button" onClick={handleVerInfo} >
              Cambiar Imagen
            </button>
          </form>
          <div className="formContainerInfo">
            <label htmlFor="descripcion">Descripción:</label>
            <br />
            <textarea
                className="textBox2"
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
            ></textarea>
            <button onClick={handleEnviarRef} className="buttons">EnviarReferencia</button>
        
          </div>
        </div>
      );

};

export default EnviarReferencia;