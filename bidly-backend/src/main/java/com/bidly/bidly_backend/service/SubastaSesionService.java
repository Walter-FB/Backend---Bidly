package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.SubastaSesion;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaSesionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class SubastaSesionService {

    @Autowired
    private SubastaSesionRepository subastaSesionRepository;

    @Autowired
    private ItemCatalogoRepository itemCatalogoRepository;

    @Autowired
    private SubastaEstadoService subastaEstadoService;

    public Optional<SubastaSesion> obtenerSesion(Long subastaId) {
        return subastaSesionRepository.findById(subastaId);
    }

    @Transactional
    public Optional<SubastaSesion> iniciarSesion(Long subastaId) {
        Optional<SubastaSesion> existente = subastaSesionRepository.findById(subastaId);
        if (existente.isPresent()) {
            return existente;
        }

        List<ItemCatalogo> items = itemCatalogoRepository.findBySubastaIdWithDetails(subastaId);
        LocalDateTime ahora = LocalDateTime.now();

        for (int i = 0; i < items.size(); i++) {
            ItemCatalogo item = items.get(i);
            if (!"si".equals(item.getSubastado())) {
                SubastaSesion sesion = new SubastaSesion();
                sesion.setSubasta(subastaId);
                sesion.setItemActivo(item.getIdentificador());
                sesion.setOrdenActual(i + 1);
                sesion.setTimerDesde(ahora);
                sesion.setIniciadaEn(ahora);
                return Optional.of(subastaSesionRepository.save(sesion));
            }
        }

        return Optional.empty();
    }

    @Transactional
    public Optional<SubastaSesion> avanzarItem(Long subastaId) {
        SubastaSesion sesion = subastaSesionRepository.findById(subastaId).orElse(null);
        if (sesion == null) {
            return Optional.empty();
        }

        List<ItemCatalogo> items = itemCatalogoRepository.findBySubastaIdWithDetails(subastaId);
        int indiceActual = indiceDeItem(items, sesion.getItemActivo());
        LocalDateTime ahora = LocalDateTime.now();

        int desde = indiceActual >= 0 ? indiceActual + 1 : 0;
        for (int i = desde; i < items.size(); i++) {
            ItemCatalogo item = items.get(i);
            if (!"si".equals(item.getSubastado())) {
                sesion.setItemActivo(item.getIdentificador());
                sesion.setOrdenActual(i + 1);
                sesion.setTimerDesde(ahora);
                return Optional.of(subastaSesionRepository.save(sesion));
            }
        }

        subastaSesionRepository.delete(sesion);
        subastaEstadoService.finalizarSubasta(subastaId);
        return Optional.empty();
    }

    @Transactional
    public void resetTimer(Long subastaId) {
        subastaSesionRepository.findById(subastaId).ifPresent(sesion -> {
            sesion.setTimerDesde(LocalDateTime.now());
            subastaSesionRepository.save(sesion);
        });
    }

    public boolean esItemActivo(Long subastaId, Long itemId) {
        return subastaSesionRepository.findById(subastaId)
                .map(s -> s.getItemActivo().equals(itemId))
                .orElse(false);
    }

    public long segundosRestantes(SubastaSesion sesion) {
        LocalDateTime cierre = sesion.getTimerDesde().plusMinutes(SubastaService.MINUTOS_INACTIVIDAD);
        return Math.max(0L, java.time.temporal.ChronoUnit.SECONDS.between(LocalDateTime.now(), cierre));
    }

    private int indiceDeItem(List<ItemCatalogo> items, Long itemId) {
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).getIdentificador().equals(itemId)) {
                return i;
            }
        }
        return -1;
    }
}
