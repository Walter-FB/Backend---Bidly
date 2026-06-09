package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Asistente;
import com.bidly.bidly_backend.model.Cliente;
import com.bidly.bidly_backend.model.Puja;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.ClienteRepository;
import com.bidly.bidly_backend.repository.PujaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/asistentes")
public class AsistenteController {

    @Autowired
    private AsistenteRepository asistenteRepository;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private PujaRepository pujaRepository;

    @GetMapping("/{id}")
    public ResponseEntity<Asistente> obtener(@PathVariable Long id) {
        return asistenteRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/pujos")
    public ResponseEntity<List<Puja>> pujos(@PathVariable Long id) {
        if (!asistenteRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pujaRepository.findByAsistenteIdentificadorOrderByImporteDesc(id));
    }

    // Busca o crea un asistente para el par (cliente, subasta).
    // Si el asistente ya existe, lo devuelve. Si no, lo crea con el próximo numeroPostor.
    @PostMapping("/inscribir")
    public ResponseEntity<?> inscribir(@RequestBody Map<String, Long> body) {
        Long clienteId = body.get("clienteId");
        Long subastaId = body.get("subastaId");

        if (clienteId == null || subastaId == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Se requieren clienteId y subastaId"));
        }

        // Devolver el existente si ya está inscripto
        var existente = asistenteRepository
                .findByClienteIdentificadorAndSubastaIdentificador(clienteId, subastaId);
        if (existente.isPresent()) {
            return ResponseEntity.ok(existente.get());
        }

        Cliente cliente = clienteRepository.findById(clienteId).orElse(null);
        Subasta subasta = subastaRepository.findById(subastaId).orElse(null);
        if (cliente == null || subasta == null) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Cliente o subasta no encontrados"));
        }
        long totalExistentes = asistenteRepository.count();
        Asistente nuevo = new Asistente();
        nuevo.setCliente(cliente);
        nuevo.setSubasta(subasta);
        nuevo.setNumeroPostor((int) (totalExistentes + 1));
        return ResponseEntity.status(201).body(asistenteRepository.save(nuevo));
    }
}
