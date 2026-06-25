package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.Notificacion;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.NotificacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class NotificacionService {

    @Autowired
    private NotificacionRepository notificacionRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private AsistenteRepository asistenteRepository;

    public void crear(Long clienteId, String tipo, String mensaje) {
        if (clienteId == null) return;
        clienteRepository.findById(clienteId).ifPresent(cliente -> {
            Notificacion n = new Notificacion();
            n.setCliente(cliente);
            n.setTipo(tipo);
            n.setMensaje(mensaje);
            n.setLeida("no");
            n.setFechaHora(LocalDateTime.now());
            notificacionRepository.save(n);
        });
    }

    public void notificarAsistentesSubasta(Long subastaId, String tipo, String mensaje) {
        if (subastaId == null) return;
        asistenteRepository.findBySubastaIdentificador(subastaId).forEach(asis -> {
            if (asis.getCliente() != null) {
                crear(asis.getCliente().getIdentificador(), tipo, mensaje);
            }
        });
    }
}
