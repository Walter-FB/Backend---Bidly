package com.bidly.bidly_backend.controller;

import com.bidly.bidly_backend.model.Asistente;
import com.bidly.bidly_backend.model.Foto;
import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.model.SubastaMoneda;
import com.bidly.bidly_backend.repository.AsistenteRepository;
import com.bidly.bidly_backend.repository.FotoRepository;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaMonedaRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import com.bidly.bidly_backend.repository.SubastaRevisionRepository;
import com.bidly.bidly_backend.service.SubastaEstadoService;
import com.bidly.bidly_backend.service.SubastaRevisionService;
import com.bidly.bidly_backend.service.SubastaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
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

    @Autowired
    private AsistenteRepository asistenteRepository;

    @Autowired
    private FotoRepository fotoRepository;

    @Autowired
    private SubastaService subastaService;

    @Autowired
    private SubastaEstadoService subastaEstadoService;

    @Autowired
    private SubastaRevisionService revisionService;

    @Autowired
    private SubastaRevisionRepository revisionRepository;

    @GetMapping
    public List<Subasta> listar(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) String moneda,
            @RequestParam(required = false, defaultValue = "true") boolean publico) {
        List<Subasta> lista;
        if ("abierta".equals(estado)) {
            lista = subastaRepository.findIniciadasByFiltros(categoria, moneda);
        } else if ("cerrada".equals(estado)) {
            lista = subastaRepository.findFinalizadasByFiltros(categoria, moneda);
        } else {
            lista = subastaRepository.findByFiltros(estado, categoria, moneda);
        }
        if (publico) {
            lista = revisionService.filtrarVisiblesPublico(lista);
        }
        subastaService.enrichAll(lista);
        return lista;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Subasta> detalle(@PathVariable Long id) {
        return subastaRepository.findById(id)
            .map(s -> {
                subastaService.enrich(s);
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
        revisionService.registrarNueva(guardada);
        subastaEstadoService.crearEstadoPendiente(guardada.getIdentificador());
        subastaService.enrich(guardada);
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
                .map(s -> {
                    subastaService.enrich(s);
                    return ResponseEntity.ok((Object) Map.of(
                            "estado", subastaEstadoService.estadoEfectivo(id)));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping(value = "/{id}/portada", produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> portada(@PathVariable Long id) {
        List<ItemCatalogo> items = itemCatalogoRepository.findByCatalogoSubastaIdentificador(id);
        if (items.isEmpty()) return ResponseEntity.notFound().build();
        Long productoId = items.get(0).getProducto().getIdentificador();
        List<Foto> fotos = fotoRepository.findByProductoIdentificador(productoId);
        if (fotos.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(fotos.get(0).getFoto());
    }

    @GetMapping("/{id}/asistentes")
    public ResponseEntity<List<Asistente>> asistentes(@PathVariable Long id) {
        if (!subastaRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(asistenteRepository.findBySubastaIdentificador(id));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<?> actualizarEstado(@PathVariable Long id,
                                               @RequestBody Map<String, String> body) {
        String nuevoEstado = body.get("estado");
        if (!"abierta".equals(nuevoEstado) && !"cerrada".equals(nuevoEstado)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El estado debe ser 'abierta' o 'cerrada'"));
        }
        if ("abierta".equals(nuevoEstado)) {
            var revision = revisionRepository.findBySubastaIdentificador(id);
            if (revision.isPresent() && !SubastaRevisionService.APROBADA.equals(revision.get().getEstado())) {
                return ResponseEntity.status(409).body(Map.of(
                        "error", "La subasta debe estar aprobada por un administrador antes de abrirse",
                        "code", "NOT_APPROVED",
                        "revisionEstado", revision.get().getEstado()));
            }
        }
        return subastaRepository.findById(id)
                .map(s -> {
                    if ("abierta".equals(nuevoEstado)) {
                        subastaEstadoService.iniciarSubasta(id);
                    } else {
                        subastaEstadoService.finalizarSubasta(id);
                    }
                    subastaService.enrich(s);
                    return ResponseEntity.ok((Object) s);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
