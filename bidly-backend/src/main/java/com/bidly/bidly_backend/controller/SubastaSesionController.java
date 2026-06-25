package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.SubastaSesion;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.service.SubastaSesionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/subastas")
public class SubastaSesionController {

    @Autowired
    private SubastaSesionService subastaSesionService;

    @Autowired
    private SubastaRepository subastaRepository;

    @GetMapping("/{id}/sesion")
    public ResponseEntity<?> sesion(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return subastaSesionService.obtenerSesion(id)
                .map(this::toResponse)
                .orElse(ResponseEntity.notFound().build());
    }

    private ResponseEntity<Map<String, Object>> toResponse(SubastaSesion sesion) {
        return ResponseEntity.ok(Map.of(
                "itemActivoId", sesion.getItemActivo(),
                "ordenActual", sesion.getOrdenActual(),
                "timerDesde", sesion.getTimerDesde().toString(),
                "segundosRestantes", subastaSesionService.segundosRestantes(sesion)
        ));
    }
}
