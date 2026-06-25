package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.SubastaRevision;
import com.bidly.bidly_backend.service.SubastaRevisionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/subasta-revision")
public class SubastaRevisionController {

    @Autowired
    private SubastaRevisionService revisionService;

    @GetMapping
    public List<SubastaRevision> listar(@RequestParam(required = false, defaultValue = "pendiente") String estado) {
        return revisionService.listar(estado);
    }

    @GetMapping("/pendientes/count")
    public Map<String, Long> contarPendientes() {
        return Map.of("pendientes", revisionService.contarPendientes());
    }

    @PatchMapping("/{subastaId}/aprobar")
    public ResponseEntity<?> aprobar(@PathVariable Long subastaId) {
        return revisionService.aprobar(subastaId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{subastaId}/pausar")
    public ResponseEntity<?> pausar(@PathVariable Long subastaId) {
        return revisionService.pausar(subastaId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{subastaId}/rechazar")
    public ResponseEntity<?> rechazar(@PathVariable Long subastaId,
                                       @RequestBody(required = false) Map<String, String> body) {
        String observacion = body != null ? body.get("observacion") : null;
        return revisionService.rechazar(subastaId, observacion)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
