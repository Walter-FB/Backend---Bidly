package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Notificacion;
import com.bidly.bidly_backend.repository.NotificacionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notificaciones")
public class NotificacionController {

    @Autowired
    private NotificacionRepository notificacionRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Notificacion> obtener(@PathVariable Long id) {
        return notificacionRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/cliente/{clienteId}")
    public ResponseEntity<List<Notificacion>> porCliente(@PathVariable Long clienteId) {
        return ResponseEntity.ok(notificacionRepository.findByClienteIdentificador(clienteId));
    }
}
