package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaMoneda;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaMonedaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/subastas")
public class SubastaController {

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaMonedaRepository subastaMonedaRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @GetMapping
    public List<Subasta> listar(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) String moneda) {
        List<Subasta> lista = subastaRepository.findByFiltros(estado, categoria, moneda);
        lista.forEach(s ->
            subastaMonedaRepository.findById(s.getIdentificador())
                .ifPresent(m -> s.setMoneda(m.getMoneda()))
        );
        return lista;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Subasta> detalle(@PathVariable Long id) {
        return subastaRepository.findById(id)
            .map(s -> {
                subastaMonedaRepository.findById(id)
                    .ifPresent(m -> s.setMoneda(m.getMoneda()));
                return ResponseEntity.ok(s);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Subasta> crear(@RequestBody Subasta subasta) {
        Subasta guardada = subastaRepository.save(subasta);
        if (subasta.getMoneda() != null && !subasta.getMoneda().isBlank()) {
            SubastaMoneda sm = new SubastaMoneda();
            sm.setSubasta(guardada.getIdentificador());
            sm.setMoneda(subasta.getMoneda());
            subastaMonedaRepository.save(sm);
            guardada.setMoneda(subasta.getMoneda());
        }
        return ResponseEntity.status(201).body(guardada);
    }

    @GetMapping("/{id}/catalogo")
    public ResponseEntity<List<ItemCatalogo>> catalogo(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(itemCatalogoRepository.findByCatalogoIdentificador(id));
    }

    @GetMapping("/{id}/catalogos")
    public ResponseEntity<List<ItemCatalogo>> catalogos(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(itemCatalogoRepository.findByCatalogoSubastaIdentificador(id));
    }

    @GetMapping("/{id}/estado")
    public ResponseEntity<?> estado(@PathVariable Long id) {
        return subastaRepository.findById(id)
                .map(s -> ResponseEntity.ok((Object) Map.of("estado", s.getEstado())))
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<?> actualizarEstado(@PathVariable Long id,
                                               @RequestBody Map<String, String> body) {
        String nuevoEstado = body.get("estado");
        if (!"abierta".equals(nuevoEstado) && !"cerrada".equals(nuevoEstado)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El estado debe ser 'abierta' o 'cerrada'"));
        }
        return subastaRepository.findById(id)
                .map(s -> {
                    s.setEstado(nuevoEstado);
                    return ResponseEntity.ok((Object) subastaRepository.save(s));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
