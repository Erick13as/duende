import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from '@fullcalendar/core/locales/es'; 
import { v4 as uuidv4 } from "uuid";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc,onSnapshot } from "firebase/firestore";
import { db } from '../firebase/firebaseConfig';
import {query, where} from 'firebase/firestore';
import { tr } from "date-fns/locale";

function Calendar() {
    const [events, setEvents] = useState([]);
    const [confirmedEvents, setConfirmedEvents] = useState([]);
    const [searchingConfirmedEvents, setSearchingConfirmedEvents] = useState(false);
    const navigate = useNavigate();
    const [eventType, setEventType] = useState("maquillaje");
    const [editedEventType, setEditedEventType] = useState("");
    const [showEventForm, setShowEventForm] = useState(false);
    const [eventDetails, setEventDetails] = useState({
      title: "",
      start: null,
      end: null,
      description: "",
    });

    const [formattedStart, setFormattedStart] = useState("");
    const [formattedEnd, setFormattedEnd] = useState("");

    const [selectedEventId, setSelectedEventId] = useState(null);

    const [showDetailsForm, setShowDetailsForm] = useState(false);
    const [selectedEventDetails, setSelectedEventDetails] = useState({
      id: "",
      title: "",
      start: null,
      end: null,
      description: "",
      tipo: "",
      numeroOrden: "",
    });

    const [showEditForm, setShowEditForm] = useState(false);
    const [selectedEditDetails, setSelectedEditDetails] = useState({
      id: "",
      title: "",
      start: null,
      end: null,
      description: "",
      tipo: "",
      numeroOrden: "",
    });
    
    useEffect(() => {
      // Cargar eventos desde la base de datos al montar el componente
      const fetchEvents = async () => {
        const eventsCollection = collection(db, 'evento');
        const eventsSnapshot = await getDocs(eventsCollection);
        const eventData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          // Suma un día a la fecha de inicio y fin solo si el tipo es distinto de "orden"
          if (data.tipo !== "orden") {
            data.start = data.start ? new Date(data.start) : null;
            data.end = data.end ? new Date(data.end) : null;
            if (data.start) data.start.setDate(data.start.getDate() + 1);
            if (data.end) data.end.setDate(data.end.getDate() + 1);
          }else{
            data.allDay = true;
            if (data.start) data.start = new Date(data.start);
            if (data.end) data.end = new Date(data.end);
          }
          return data;
        });
        setEvents(eventData);
      };
  
      fetchEvents();
    }, []);

    const handleDateSelect = (selectInfo) => {
      setEventDetails({
        title: "",
        start: selectInfo.startStr,
        end: selectInfo.endStr,
        description: "",
        numeroOrden: "",
      });
      setShowEventForm(true);
    };

    //Cargar ordenes confirmadas
    useEffect(() => {
      // Consulta inicial para obtener las órdenes confirmadas
      const initialFetch = async () => {
        try {
          const confirmedOrdersQuery = query(collection(db, 'orden'), where('estado', '==', 'confirmada'));
          const confirmedOrdersSnapshot = await getDocs(confirmedOrdersQuery);
          const confirmedOrdersData = confirmedOrdersSnapshot.docs.map((doc) => doc.data());
  
          setConfirmedEvents(confirmedOrdersData);
          console.log("Dentro del original",confirmedOrdersData)

          handleOrderEvent();
        } catch (error) {
          console.error('Error al obtener órdenes confirmadas:', error);
        }
      };
  
      // Agrega el listener para escuchar cambios en las órdenes confirmadas
      const ordersCollection = collection(db, 'orden');
      const confirmedOrdersQuery = query(ordersCollection, where('estado', '==', 'confirmada'));
      const unsubscribe = onSnapshot(confirmedOrdersQuery, (snapshot) => {
        const confirmedOrdersData = snapshot.docs.map((doc) => doc.data());
        setConfirmedEvents(confirmedOrdersData);

        //initialFetch();
      });
  
      // Limpia el listener al desmontar el component
      return () => unsubscribe();

    }, []);

    useEffect(() => {
      // Llama a la función para manejar eventos de órdenes cuando cambian los eventos confirmados
      handleOrderEvent();
    }, [confirmedEvents]);

    //con esta función voy a intentar crear eventos a partir de las ordenes confirmadas alamacenadas en confirmedOrdersData.
    const handleOrderEvent = async () => {
      try {
        const newConfirmedEvents = [];
    
        for (const order of confirmedEvents) {
          const eventExists = await doesEventExistWithNumeroOrden(order.numeroOrden);
    
          if (!eventExists) {
            const nextEventId = generateUniqueEventId();
    
            const newEvent = {
              id: nextEventId,
              title: `Orden ${order.numeroOrden}`,
              start: order.fechaEntrega.toDate(),
              end: new Date(order.fechaEntrega.toDate().getTime() + 10 * 60000),
              description: `Entrega de la Orden ${order.numeroOrden} con destino ${order.direccionEntrega}`,
              tipo: "orden",
              numeroOrden: order.numeroOrden,
            };
    
            await addEventToDatabase(newEvent);
    
            // Add the new event to the list of confirmed events
            newConfirmedEvents.push(newEvent);
          }
        }
    
        // Update the state only with events that don't already exist in confirmedEvents
        setConfirmedEvents((prevConfirmedEvents) => [
          ...prevConfirmedEvents,
          ...newConfirmedEvents.filter((newEvent) =>
            !prevConfirmedEvents.some(
              (prevEvent) => prevEvent.numeroOrden === newEvent.numeroOrden
            )
          ),
        ]);
      } catch (error) {
        console.error('Error al manejar eventos de órdenes:', error);
      }
    };
    
    
    
    const doesEventExistWithNumeroOrden = async (numeroOrden) => {
      const eventQuery = query(collection(db, 'evento'), where('numeroOrden', '==', numeroOrden));
      const eventSnapshot = await getDocs(eventQuery);
      return !eventSnapshot.empty;
    };
    
    const addEventToDatabase = async (event) => {
      const eventCollection = collection(db, 'evento');
      await addDoc(eventCollection, {
        id: event.id,
        title: event.title,
        start: new Date(event.start).toISOString(),
        end: new Date(event.end).toISOString(),
        description: event.description,
        tipo: event.tipo,
        numeroOrden: event.numeroOrden,
      });
    };
    
    const generateUniqueEventId = () => {
      let nextEventId;
      do {
        nextEventId = uuidv4();
      } while (isNaN(parseInt(nextEventId, 10)));
      return parseInt(nextEventId, 10);
    };

    // Función para verificar si ya existe un evento con el mismo numeroOrden
    const noId = async (numeroId) => {
      const eventQuery = query(collection(db, 'evento'), where('id', '==', numeroId));
      const eventSnapshot = await getDocs(eventQuery);
      return !eventSnapshot.empty;
    };
    
    const handleEventClick = (clickInfo) => {
      setSelectedEventDetails({
        id: clickInfo.event.id,
        title: clickInfo.event.title,
        start: clickInfo.event.start,
        end: clickInfo.event.end,
        description: clickInfo.event.extendedProps.description || "",
        tipo: clickInfo.event.extendedProps.tipo || "",
        numeroOrden: clickInfo.event.extendedProps.numeroOrden,
      });
    
      // Verificar que start y end no sean null antes de intentar formatear
      if (clickInfo.event.start && clickInfo.event.end) {
        // Selecciona solo la hora desde la fecha de inicio y fin
        setFormattedStart(clickInfo.event.start.toLocaleString());
        setFormattedEnd(clickInfo.event.end.toLocaleString());
      }
    
      setShowDetailsForm(true);
      setSelectedEventId(clickInfo.event.id);
      console.log("ajua", selectedEventDetails)
      setEditedEventType(selectedEventDetails.tipo);

    };
    
    const handleGoGalery= () => {
      navigate('/galeriaAdmin');
    };

    const handleGoStore= () => {
      navigate('/AccederTiendaAdmin');
    };

    const handleCancel = () => {
      setShowEventForm(false);
      setShowDetailsForm(false);
      setShowEditForm(false);
    };

    const handleEditEvent = () => {
      setShowDetailsForm(false);
      setShowEditForm(true);
    };

    const getNextEventId = (events) => {
      // Obtener el máximo ID existente
      const maxId = events.reduce((max, event) => (event.id > max ? event.id : max), 0);
      // Incrementar el máximo ID para el próximo evento
      return maxId + 1;
    };

    const handleSaveEvent = async () => {
      try {
        const newStartDate = new Date(eventDetails.start);
        const newEndDate = new Date(eventDetails.end);

        let tipoEvento = "";

        // Verificar si hay algún evento que choque con el nuevo evento
        const hasConflict = events.some(existingEvent => {

          // Ignorar eventos de tipo "orden" con la propiedad "allDay" configurada como true
          if (existingEvent.tipo === "orden" && existingEvent.allDay) {
            return false;
          }

          // Convertir las fechas de inicio y fin de los eventos existentes a objetos Date
          const existingStartDate = new Date(existingEvent.start);
          const existingEndDate = new Date(existingEvent.end);
        
          // Verificar si hay solapamiento de horarios
          tipoEvento = existingEvent.tipo;
          return (
            (newStartDate < existingEndDate && newEndDate > existingStartDate) ||
            (newEndDate > existingStartDate && newStartDate < existingEndDate)
          );
        });

        if (hasConflict) {
          // Mostrar un mensaje al usuario y manejar la lógica según sea necesario
          let userResponse = false;//window.confirm("¡Advertencia! Hay un evento existente en este horario. ¿Desea agregar el evento de todos modos?");
          let userAns = false;

          // Si el tipo de evento es "maquillaje", verificar si ya hay un evento de "maquillaje" en este horario
          if (tipoEvento === "maquillaje" && hasConflict) {
            userAns = window.confirm("¡Advertencia! Hay un evento existente en este horario. No se puede agendar un evento de maquillaje en horario conflictivo.");
            //return;
          } else if (hasConflict) {
            // Mostrar un mensaje al usuario indicando que no se puede agendar un evento de maquillaje en este horario
            userResponse = window.confirm("Ya hay un evento en este horario. ¿Deseas agregar el evento en horario conflictivo?");
            //return;
          } 
          
          if (userAns) {
            return;

          }else if (userResponse) {
            // El usuario canceló la operación

            newStartDate.setDate(newStartDate.getDate() - 1);
            newEndDate.setDate(newEndDate.getDate() - 1);

            if (eventDetails.id) {
              // Si el evento ya tiene un ID, actualiza el evento existente
              const eventRef = doc(db, 'evento', eventDetails.id);
              await updateDoc(eventRef, {
                title: eventDetails.title,
                start: newStartDate.toISOString(),
                end: newEndDate.toISOString(),
                description: eventDetails.description,
                tipo: eventType, // Utiliza el tipo seleccionado en el combobox
              });
            } else {
              // Si el evento no tiene un ID, crea un nuevo evento con un ID incremental
              const nextEventId = getNextEventId(events);
              
              const newEventRef = await addDoc(collection(db, 'evento'), {
                id: nextEventId,
                title: eventDetails.title,
                start: newStartDate.toISOString(),
                end: newEndDate.toISOString(),
                description: eventDetails.description,
                tipo: eventType, // Utiliza el tipo seleccionado en el combobox
              });
            }

            // Recarga los eventos desde la base de datos
            const updatedEvents = await fetchEvents();
            setEvents(updatedEvents);
            
            setShowEventForm(false);

            //return;
          }
        }else{
          // Elimina un día de la fecha inicio y fin
          newStartDate.setDate(newStartDate.getDate() - 1);
          newEndDate.setDate(newEndDate.getDate() - 1);

          if (eventDetails.id) {
            // Si el evento ya tiene un ID, actualiza el evento existente
            const eventRef = doc(db, 'evento', eventDetails.id);
            await updateDoc(eventRef, {
              title: eventDetails.title,
              start: newStartDate.toISOString(),
              end: newEndDate.toISOString(),
              description: eventDetails.description,
              tipo: eventType, // Utiliza el tipo seleccionado en el combobox
            });
          } else {
            // Si el evento no tiene un ID, crea un nuevo evento con un ID incremental
            const nextEventId = getNextEventId(events);
            
            const newEventRef = await addDoc(collection(db, 'evento'), {
              id: nextEventId,
              title: eventDetails.title,
              start: newStartDate.toISOString(),
              end: newEndDate.toISOString(),
              description: eventDetails.description,
              tipo: eventType, // Utiliza el tipo seleccionado en el combobox
            });
          }

          // Recarga los eventos desde la base de datos
          const updatedEvents = await fetchEvents();
          setEvents(updatedEvents);
          
          setShowEventForm(false);
        }

      } catch (error) {
        console.error("Error al guardar el evento:", error)
      }
    };
    
    
    const handleDeleteEvent = async () => {
      if (selectedEventId){
        try {

          const querySnapshot = await getDocs(collection(db, 'evento'));

          querySnapshot.forEach(async (doc) => {
              const data = doc.data();

              if (data.id === parseInt(selectedEventId, 10)) {
                  const categoryRef = doc.ref;

                  await deleteDoc(categoryRef);

                  const updatedEvents = await fetchEvents();
                  setEvents(updatedEvents);
                  
              }

          });

          // Oculta el formulario después de eliminar el evento
          setShowEditForm(false);
      
        } catch (error) {
          // Manejo de errores: muestra un mensaje de error al usuario o realiza cualquier otra acción necesaria.
          console.error('Error al eliminar el evento:', error);
        }
      }
    };
    
    const fetchEvents = async () => {
      const eventsCollection = collection(db, 'evento');
      const eventsSnapshot = await getDocs(eventsCollection);
      const eventData = eventsSnapshot.docs.map((doc) => {
        const data = doc.data();
        // Suma un día a la fecha de inicio y fin solo si el tipo es distinto de "orden"
        if (data.tipo !== "orden") {
          data.start = data.start ? new Date(data.start) : null;
          data.end = data.end ? new Date(data.end) : null;
          if (data.start) data.start.setDate(data.start.getDate() + 1);
          if (data.end) data.end.setDate(data.end.getDate() + 1);
        } else{
          data.allDay = true;
          if (data.start) data.start = new Date(data.start);
          if (data.end) data.end = new Date(data.end);
        }
        return data;
      });
      return eventData;
    };
    

    const formatDatetimeLocal = (date) => {
      if (!date || !(date instanceof Date)) {
        return ""; // Manejar el caso de fecha nula o no válida
      }
    
      const year = date.getFullYear();
      const month = (`0${date.getMonth() + 1}`).slice(-2);
      const day = (`0${date.getDate()}`).slice(-2);
      const hours = (`0${date.getHours()}`).slice(-2);
      const minutes = (`0${date.getMinutes()}`).slice(-2);
    
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    const handleUpdateEvent = async () => {
      try {
        const formattedStart = selectedEventDetails.start ? new Date(selectedEventDetails.start) : null;
        const formattedEnd = selectedEventDetails.end ? new Date(selectedEventDetails.end) : null;
        console.log(editedEventType)
        
        let tipoEvento = "";

        console.log("edited type:" + editedEventType)
        
        
    
        if (editedEventType !== "" && editedEventType !== "orden") {
          if (formattedStart) formattedStart.setDate(formattedStart.getDate() - 1);
          if (formattedEnd) formattedEnd.setDate(formattedEnd.getDate() - 1);
          console.log("Hola" )
        }
        console.log("Start:" + formattedStart )
        console.log("End:" + formattedEnd )
        let comparacionStart = new Date(formattedStart);  // Clona la fecha original
        let comparacionEnd = new Date(formattedEnd);  // Clona la fecha original
        comparacionStart.setDate(comparacionStart.getDate() + 1);
        comparacionEnd.setDate(comparacionEnd.getDate() + 1);
        console.log("Original S:" + formattedStart)
        console.log("Original E:" + formattedEnd)
    
        const hasConflict = events.some(existingEvent => {

          // Ignorar eventos de tipo "orden" con la propiedad "allDay" configurada como true
          if (existingEvent.tipo === "orden" && existingEvent.allDay) {
            return false;
          }
          if (existingEvent.title === selectedEventDetails.title) {
            return false;
          }

          // Convertir las fechas de inicio y fin de los eventos existentes a objetos Date
          const existingStartDate = new Date(existingEvent.start);
          const existingEndDate = new Date(existingEvent.end);
        
          // Verificar si hay solapamiento de horarios
          tipoEvento = existingEvent.tipo;

          
          console.log("Inicio: " + existingStartDate)
          console.log("Fin: " + existingEndDate + "\n")
          return (
            (comparacionStart < existingEndDate && comparacionEnd > existingStartDate) ||
            (comparacionEnd > existingStartDate && comparacionStart < existingEndDate)
          );
        });

        if (hasConflict) {
          // Mostrar un mensaje al usuario y manejar la lógica según sea necesario
          let userResponse = false;//window.confirm("¡Advertencia! Hay un evento existente en este horario. ¿Desea agregar el evento de todos modos?");
          let userAns = false;

          // Si el tipo de evento es "maquillaje", verificar si ya hay un evento de "maquillaje" en este horario
          if (tipoEvento === "maquillaje" && hasConflict) {
            userAns = window.confirm("¡Advertencia! Hay un evento existente en este horario. No se puede agendar un evento de maquillaje en horario conflictivo.");
            //return;
          } else if (hasConflict) {
            // Mostrar un mensaje al usuario indicando que no se puede agendar un evento de maquillaje en este horario
            userResponse = window.confirm("Ya hay un evento en este horario. ¿Deseas agregar el evento en horario conflictivo?");
            //return;
          } 
          
          if (userAns) {
            return;

          }else if (userResponse) {
            const updatedQuery = query(
              collection(db, 'evento'),
              where('id', '==', parseInt(selectedEventDetails.id))
            );
        
            const querySnapshot = await getDocs(updatedQuery);
        
            if (!querySnapshot.empty) {
              const docRef = querySnapshot.docs[0].ref;
        
              await updateDoc(docRef, {
                id: parseInt(selectedEventDetails.id),
                title: selectedEventDetails.title,
                start: formattedStart ? formattedStart.toISOString() : null,
                end: formattedEnd ? formattedEnd.toISOString() : "",
                description: selectedEventDetails.description,
              });
        
              const updatedEvents = await fetchEvents();
              setEvents(updatedEvents);
            }
          }} else{
              const updatedQuery = query(
                collection(db, 'evento'),
                where('id', '==', parseInt(selectedEventDetails.id))
              );
          
              const querySnapshot = await getDocs(updatedQuery);
          
              if (!querySnapshot.empty) {
                const docRef = querySnapshot.docs[0].ref;
          
                await updateDoc(docRef, {
                  id: parseInt(selectedEventDetails.id),
                  title: selectedEventDetails.title,
                  start: formattedStart ? formattedStart.toISOString() : null,
                  end: formattedEnd ? formattedEnd.toISOString() : "",
                  description: selectedEventDetails.description,
                });
          
                const updatedEvents = await fetchEvents();
                setEvents(updatedEvents);
              }
            }
      } catch (error) {
        console.error("Error al actualizar datos:", error);
      }
      setShowEditForm(false);
    };
    
    

    const handleViewOrder = () => {
      const dirOrden = selectedEventDetails.numeroOrden
      navigate(`/OrdenAdmin/${dirOrden}`);
    };

    return (
      <div>
        {/*Esta primera parte es el form que sale para añadir un evento*/}
        {showEventForm && (
          <div className="event-form-overlay">
            <div className="event-form-container">
              <h1>Creación de Evento</h1>
              <label htmlFor="eventType">Tipo de Evento:</label>
              <select
                id="eventType"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="maquillaje">Maquillaje</option>
                <option value="reunion">Reunión</option>
              </select>

              <label htmlFor="eventTitle">Agregar Título:</label>
              <input
                type="text"
                id="eventTitle"
                value={eventDetails.title}
                onChange={(e) =>
                  setEventDetails({ ...eventDetails, title: e.target.value })
                }
              />

              <label htmlFor="eventStart">Fecha de inicio:</label>
              <input
                type="datetime-local"
                id="eventStart"
                value={eventDetails.start ? formatDatetimeLocal(eventDetails.start) : ""}
                onChange={(e) =>
                  setEventDetails({
                    ...eventDetails,
                    start: new Date(e.target.value),
                  })
                }
              />
              <label htmlFor="eventEnd">Fecha de fin:</label>
              <input
                type="datetime-local"
                id="eventEnd"
                value={eventDetails.end ? formatDatetimeLocal(eventDetails.end) : ""}
                onChange={(e) =>
                  setEventDetails({
                    ...eventDetails,
                    end: new Date(e.target.value),
                  })
                }
              />
              <label htmlFor="eventDescription">Descripción:</label>
              <textarea
                id="eventDescription"
                value={eventDetails.description}
                onChange={(e) =>
                  setEventDetails({ ...eventDetails, description: e.target.value })
                }
              />
              {/* Agrega otros campos del formulario según tus necesidades */}
              <button onClick={handleSaveEvent}>Crear Evento</button>
              <button onClick={handleCancel}>Cerrar</button>
            </div>
          </div>
        )}


        {/*Esta parte es el form para ver detalles del evento*/}
        {showDetailsForm && (
          <div className="event-form-overlay">
            <div className="event-form-container">
              <h1>Detalles del Evento</h1>
              <label htmlFor="eventTitle">Título:</label>
              <input
                type="text"
                id="eventTitle"
                value={selectedEventDetails.title}
                readOnly={true}
              />

              <div style={{ marginBottom: '8px' }}>
                <label>ID del Evento: </label>
                <span style={{ fontWeight: 'bold' }}>{selectedEventDetails.id}</span>
              </div>
              

              <div style={{ marginBottom: '8px' }}>
                <label>Tipo: </label>
                <span style={{ fontWeight: 'bold' }}>{selectedEventDetails.tipo}</span>
              </div>

              <span>{""}</span>

              <label htmlFor="eventStart">Fecha de inicio:</label>
              <input
                type="datetime-local"
                id="eventStart"
                value={selectedEventDetails.start ? formatDatetimeLocal(selectedEventDetails.start) : ""}
                readOnly={true}
              />
              {selectedEventDetails.tipo !== "orden" && (
                <div className="event-form-container">
                <label htmlFor="eventEnd">Fecha de fin:</label>
                <input
                  type="datetime-local"
                  id="eventEnd"
                  value={selectedEventDetails.end ? formatDatetimeLocal(selectedEventDetails.end) : ""}
                  readOnly={true}
                />
                </div>
              )}
              <label htmlFor="eventDescription">Descripción:</label>
              <textarea
                id="eventDescription"
                value={selectedEventDetails.description}
                readOnly={true}
              />

              {selectedEventDetails.tipo === "orden" && (
                <button onClick={handleViewOrder}>Ver Orden</button>
              )}
              <button onClick={handleEditEvent}>Editar Evento</button>
              <button onClick={handleCancel}>Cerrar</button>
            </div>
          </div>
        )}

        {/*Esta parte es el form para editar el evento*/}
        {showEditForm && (
          <div className="event-form-overlay">
            <div className="event-form-container">
            <h1>Editar Evento</h1>
              {/* Mostrar el campo de edición del tipo de evento solo si el tipo no es "orden" */}
              <label htmlFor="eventTitle">Título del Evento:</label>
              <input
                type="text"
                id="eventTitle"
                value={selectedEventDetails.title}
                onChange={(e) =>
                  setSelectedEventDetails({ ...selectedEventDetails, title: e.target.value })
                }
              />

              <label htmlFor="eventStart">Fecha de inicio:</label>
              <input
                type="datetime-local"
                id="eventStart"
                value={selectedEventDetails.start ? formatDatetimeLocal(selectedEventDetails.start) : ""}
                onChange={(e) =>
                  setSelectedEventDetails({
                    ...selectedEventDetails,
                    start: new Date(e.target.value),
                  })
                }
              />
              {selectedEventDetails.tipo !== "orden" && (
                <div className="event-form-container">
                  <label htmlFor="eventEnd">Fecha de fin:</label>
                  <input
                    type="datetime-local"
                    id="eventEnd"
                    value={selectedEventDetails.end ? formatDatetimeLocal(selectedEventDetails.end) : ""}
                    onChange={(e) =>
                      setSelectedEventDetails({
                        ...selectedEventDetails,
                        end: new Date(e.target.value),
                      })
                    }
                  />
                  </div>)}
                
              <label htmlFor="eventDescription">Descripción:</label>
              <textarea
                id="eventDescription"
                value={selectedEventDetails.description}
                onChange={(e) =>
                  setSelectedEventDetails({ ...selectedEventDetails, description: e.target.value })
                }
              />
              {/* Agrega otros campos del formulario según tus necesidades */}
              <button onClick={handleUpdateEvent}>Guardar Cambios</button>
              <button onClick={handleDeleteEvent}>Eliminar evento</button>
              <button onClick={handleCancel}>Cerrar</button>
            </div>
          </div>
        )}


        {/*Esta parte es la que muestra el calendario*/}
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={"dayGridMonth"}
          headerToolbar={{
            start: "today prev,next goGalery goStore", // Los botones en la barra superior izquierda
            center: "title",
            end: "dayGridMonth,timeGridWeek,timeGridDay", // Los botones en la barra superior izquierda
          }}
          //En esta parte se añaden botones personalizados
          customButtons={{
            goGalery: {
              text: "Galería",
              click: handleGoGalery,
            },
            goStore: {
              text: "Tienda",
              click: handleGoStore,
            },
          }}
          height={"90vh"}
          selectable={true} // Habilita la selección de fechas
          select={handleDateSelect}
          eventClick={handleEventClick}
          events={events}
          //Estas 3 lineas son para ajustar un ver más cuando hay muchos eventos
          dayMaxEventRows={true}
          dayMaxEvents={4} // Cantidad de eventos que se muestran por día
          moreLinkClick="popover"
          editable={true} //permite arrastrar los eventos
          eventDurationEditable={true} //editar la duración redimensionando el evento. Es horizontal, para varios días
          eventStartEditable={true} // editar hora de inicio arrastrando la actividad
          //eventOverlap={false} // false para que no pueda haber un evento a la misma hora que el otro.
          navLinks={true} // permite que los dias lleven a otra parte
          navLinkDayClick="timeGridDay" // presionar el número del día lo lleva al a vista de ese día
          weekNumbers={true} //muestra el número de la semana
          weekNumberCalculation="ISO" //la semana empieza con lunes
          weekNumberFormat={{
            week: 'numeric', //Muestra la semana con número y no letras
          }}
          nowIndicator={true} //esto le dice en dónde está cuando utiliza la vista del día
          locales={[esLocale]}  // Configura el locale español
          locale="es"  // Establece el idioma español
          defaultAllDayEventDuration={{ days: 1 }}
        />
      </div>
    );
  }
  
  export default Calendar;